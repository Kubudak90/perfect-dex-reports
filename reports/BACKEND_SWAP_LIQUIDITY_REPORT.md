# BaseBook DEX Backend System Report
## Swap and Liquidity Operations Analysis

**Date:** February 5, 2026
**Version:** 1.0
**Author:** Backend Engineering Analysis

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Swap Flow](#2-swap-flow)
3. [Liquidity Management](#3-liquidity-management)
4. [API Endpoints](#4-api-endpoints)
5. [Price Calculation](#5-price-calculation)
6. [Error Handling](#6-error-handling)
7. [Performance](#7-performance)
8. [Integration Status](#8-integration-status)

---

## 1. Architecture Overview

### 1.1 System Components

The BaseBook DEX backend follows a layered architecture pattern connecting a Node.js/TypeScript API server to Solidity smart contracts deployed on Base chain.

```
+-------------------+     +-------------------+     +-------------------+
|    Frontend       | --> |   Backend API     | --> |   Smart Contracts |
|    (React)        |     |   (Fastify)       |     |   (Solidity)      |
+-------------------+     +-------------------+     +-------------------+
                               |       |
                          +----+       +----+
                          |                 |
                     +----v----+      +-----v-----+
                     | Redis   |      | PostgreSQL |
                     | (Cache) |      | (Storage)  |
                     +---------+      +-----------+
```

### 1.2 Core Smart Contracts

| Contract | Purpose | File Location |
|----------|---------|---------------|
| **PoolManager** | Singleton managing all pools, swaps, and liquidity | `/root/basebook/contracts/src/core/PoolManager.sol` |
| **SwapRouter** | Routes swaps, handles multi-hop, Permit2 | `/root/basebook/contracts/src/core/SwapRouter.sol` |
| **Quoter** | Provides gas-free quotes via static calls | `/root/basebook/contracts/src/core/Quoter.sol` |
| **PositionManager** | NFT-based liquidity position management | `/root/basebook/contracts/src/core/PositionManager.sol` |

### 1.3 Backend Service Architecture

```
backend/src/
├── api/
│   ├── routes/          # Route definitions
│   ├── handlers/        # Request handlers
│   ├── schemas/         # Zod validation schemas
│   ├── errors/          # Custom error classes
│   └── middleware/      # Error handler, rate limiter
├── blockchain/
│   ├── abis/            # Contract ABIs
│   ├── contracts/       # Contract interaction helpers
│   └── client.ts        # viem blockchain client
├── cache/               # Redis caching layer
├── db/schema/           # Drizzle ORM schemas
├── services/            # Business logic services
├── websocket/           # Real-time WebSocket manager
└── workers/             # Background sync workers
```

### 1.4 Contract Integration Pattern

The backend uses `viem` library for blockchain interactions:

```typescript
// /root/basebook/backend/src/blockchain/client.ts
export function createBlockchainClient(chainId: SupportedChainId): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    batch: {
      multicall: {
        wait: 16, // 16ms batching window for multicall optimization
      },
    },
  });
}
```

### 1.5 Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Base Mainnet | 8453 | Partial (addresses not fully deployed) |
| Base Sepolia | 84532 | **Fully Deployed** |

---

## 2. Swap Flow

### 2.1 Complete Swap Execution Path

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SWAP EXECUTION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

1. Frontend Request
   │
   ▼
2. GET /v1/swap/quote
   │  Parameters: chainId, tokenIn, tokenOut, amountIn, slippage
   │
   ▼
3. SwapHandler.getQuote() [/root/basebook/backend/src/api/handlers/swap.handler.ts]
   │
   ├── Check Redis cache for existing quote
   │
   ├── Query tokens from PostgreSQL
   │
   ├── Find best pool (highest TVL)
   │
   ├── Fetch on-chain pool state via PoolManager
   │
   ├── Call Quoter contract for price quote
   │
   └── Return quote with route information
   │
   ▼
4. Frontend builds transaction
   │
   ▼
5. User signs and submits to SwapRouter contract
   │
   ▼
6. SwapRouter.exactInputSingle() [On-chain]
   │
   └── PoolManager.swap() [On-chain]
```

### 2.2 Quote Generation Process

The backend generates quotes through the `SwapHandler`:

```typescript
// /root/basebook/backend/src/api/handlers/swap.handler.ts
getQuote = async (request, reply) => {
  const { chainId, tokenIn, tokenOut, amountIn, slippage } = request.query;

  // 1. Check cache first
  const cacheKey = CacheKeys.quote(chainId, tokenIn, tokenOut, amountIn);
  const cached = await this.cache.get<GetQuoteResponse>(cacheKey);
  if (cached) return reply.send({ ...cached, cached: true });

  // 2. Get tokens from database
  const tokenInData = await this.fastify.db.select().from(tokens)...
  const tokenOutData = await this.fastify.db.select().from(tokens)...

  // 3. Find best pool for this pair
  const availablePools = await this.fastify.db.select().from(pools)
    .where(or(
      and(eq(pools.token0Id, tokenInData.id), eq(pools.token1Id, tokenOutData.id)),
      and(eq(pools.token0Id, tokenOutData.id), eq(pools.token1Id, tokenInData.id))
    ))
    .orderBy((pools) => pools.tvlUsd);

  // 4. Get fresh on-chain pool state
  const poolState = await getPoolState(chainId, bestPool.poolId);

  // 5. Get quote from Quoter contract
  const quoteResult = await quoteExactInputSingle(chainId, {
    poolKey,
    zeroForOne,
    exactAmount: BigInt(amountIn),
    sqrtPriceLimitX96: calculateSqrtPriceLimit(zeroForOne, slippage * 100),
    hookData: '0x',
  });

  // 6. Cache and return
  await this.cache.set(cacheKey, response, CacheTTL.quote);
  return reply.send(response);
};
```

### 2.3 On-Chain Quoter Contract

The Quoter contract simulates swaps without executing them:

```solidity
// /root/basebook/contracts/src/core/Quoter.sol
function quoteExactInputSingle(QuoteParams memory params) external returns (QuoteResult memory result) {
    // Get pool state
    bytes32 poolId = keccak256(abi.encode(params.poolKey));
    (uint160 sqrtPriceX96, int24 tick, , uint24 lpFee) = poolManager.getSlot0(poolId);
    uint128 liquidity = poolManager.getLiquidity(poolId);

    // Simulate swap using SwapMath
    (uint160 sqrtPriceNextX96, uint256 amountIn, uint256 amountOut, uint256 feeAmount) =
        SwapMath.computeSwapStep(sqrtPriceX96, sqrtPriceLimitX96, liquidity, params.amountSpecified, lpFee);

    result = QuoteResult({
        amountIn: amountIn + feeAmount,
        amountOut: amountOut,
        sqrtPriceX96After: sqrtPriceNextX96,
        tickAfter: tickAfter,
        gasEstimate: gasBefore - gasAfter
    });
}
```

### 2.4 SwapRouter Contract Functions

| Function | Type | Description |
|----------|------|-------------|
| `exactInputSingle` | Single-hop | Swap exact amount in for maximum out |
| `exactInput` | Multi-hop | Exact input through encoded path |
| `exactOutputSingle` | Single-hop | Swap minimum in for exact amount out |
| `exactOutput` | Multi-hop | Exact output through reversed path |
| `exactInputMultihop` | Convenience | Array of PoolKeys for multi-hop |
| `exactOutputMultihop` | Convenience | Array of PoolKeys for multi-hop |
| `exactInputSingleWithPermit2` | Gasless | With Permit2 signature |

### 2.5 Multi-Hop Swap Path Encoding

```typescript
// /root/basebook/backend/src/blockchain/contracts/swapRouter.ts
export function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  // Format: tokenIn | fee | tokenOut | fee | ... | finalTokenOut
  let path = '0x';
  for (let i = 0; i < fees.length; i++) {
    path += tokens[i].slice(2);           // Token address (20 bytes)
    path += fees[i].toString(16).padStart(6, '0'); // Fee (3 bytes)
  }
  path += tokens[tokens.length - 1].slice(2); // Final token
  return path as `0x${string}`;
}
```

### 2.6 Rust Router Service (Future Integration)

A high-performance Rust router service is planned for optimal route finding:

```typescript
// /root/basebook/backend/src/services/router.service.ts
export class RouterService {
  async getQuote(request: RouterQuoteRequest): Promise<RouterQuoteResponse> {
    const params = {
      token_in: request.token_in,
      token_out: request.token_out,
      amount_in: request.amount_in,
      slippage: request.slippage ?? 0.5,
      max_hops: request.max_hops,
      max_splits: request.max_splits,
    };
    return await this.client.get<RouterQuoteResponse>('/v1/quote', { params });
  }
}
```

---

## 3. Liquidity Management

### 3.1 Position NFT Architecture

Each liquidity position is represented as an ERC-721 NFT token managed by the `PositionManager` contract.

```solidity
// /root/basebook/contracts/src/core/PositionManager.sol
struct Position {
    uint96 nonce;
    address operator;
    uint80 poolId;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
    uint256 feeGrowthInside0LastX128;
    uint256 feeGrowthInside1LastX128;
    uint128 tokensOwed0;
    uint128 tokensOwed1;
}
```

### 3.2 Add Liquidity Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ADD LIQUIDITY FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. User selects pool, tick range, amounts
   │
   ▼
2. Frontend calculates optimal liquidity
   │
   ▼
3. User approves tokens for PositionManager
   │
   ▼
4. PositionManager.mint() [On-chain]
   │
   ├── Validate tick range
   │
   ├── Calculate liquidity from amounts
   │
   ├── Call PoolManager.modifyLiquidity()
   │
   ├── Transfer tokens from user
   │
   ├── Mint NFT to user
   │
   └── Store position data
   │
   ▼
5. Emit IncreaseLiquidity event
```

### 3.3 PositionManager Contract Operations

**Mint (Add New Position):**
```solidity
function mint(MintParams calldata params)
    external payable nonReentrant checkDeadline(params.deadline)
    returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
{
    // Validate tick range
    if (params.tickLower >= params.tickUpper) revert InvalidTickRange();

    // Calculate liquidity
    liquidity = _calculateLiquidity(sqrtPriceX96, params.tickLower, params.tickUpper,
                                     params.amount0Desired, params.amount1Desired);

    // Add liquidity to pool
    IPoolManager.ModifyLiquidityParams memory modifyParams = IPoolManager.ModifyLiquidityParams({
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        liquidityDelta: int256(uint256(liquidity))
    });
    poolManager.modifyLiquidity(params.poolKey, modifyParams);

    // Mint NFT
    tokenId = _nextId++;
    _mint(params.recipient, tokenId);
}
```

**Increase Liquidity:**
```solidity
function increaseLiquidity(IncreaseLiquidityParams calldata params)
    external payable nonReentrant checkDeadline(params.deadline)
    isAuthorizedForToken(params.tokenId)
    returns (uint128 liquidity, uint256 amount0, uint256 amount1)
```

**Decrease Liquidity:**
```solidity
function decreaseLiquidity(DecreaseLiquidityParams calldata params)
    external nonReentrant checkDeadline(params.deadline)
    isAuthorizedForToken(params.tokenId)
    returns (uint256 amount0, uint256 amount1)
```

**Collect Fees:**
```solidity
function collect(CollectParams calldata params)
    external nonReentrant isAuthorizedForToken(params.tokenId)
    returns (uint256 amount0, uint256 amount1)
```

### 3.4 Backend Position Reading

```typescript
// /root/basebook/backend/src/blockchain/contracts/positionManager.ts
export async function getPositionsByOwner(
  chainId: number,
  owner: Address
): Promise<Array<{ tokenId: bigint; position: Position }>> {
  const balance = await getPositionBalance(chainId, owner);

  // Get all token IDs using multicall
  const tokenIdCalls = Array.from({ length: balanceNumber }, (_, i) => ({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [owner, BigInt(i)],
  }));
  const tokenIdsResults = await client.multicall({ contracts: tokenIdCalls });

  // Get position details using multicall
  const positionCalls = tokenIds.map((tokenId) => ({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'positions',
    args: [tokenId],
  }));
  const positionsResults = await client.multicall({ contracts: positionCalls });

  return /* parsed positions */;
}
```

### 3.5 Database Schema for Positions

```typescript
// /root/basebook/backend/src/db/schema/positions.ts
export const userPositions = pgTable('user_positions', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(),
  chainId: integer('chain_id').notNull(),
  owner: varchar('owner', { length: 42 }).notNull(),
  poolId: integer('pool_id').references(() => pools.id).notNull(),
  tickLower: integer('tick_lower').notNull(),
  tickUpper: integer('tick_upper').notNull(),
  liquidity: numeric('liquidity', { precision: 78 }).notNull(),
  depositedToken0: numeric('deposited_token0', { precision: 78 }),
  depositedToken1: numeric('deposited_token1', { precision: 78 }),
  unclaimedFees0: numeric('unclaimed_fees0', { precision: 78 }),
  unclaimedFees1: numeric('unclaimed_fees1', { precision: 78 }),
});
```

---

## 4. API Endpoints

### 4.1 Swap Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/v1/swap/quote` | Get swap quote | **Implemented** |
| POST | `/v1/swap/route` | Multi-hop routing (Rust router) | Planned |
| POST | `/v1/swap/build` | Build swap transaction | Planned |

**GET /v1/swap/quote**

Request Parameters:
```typescript
// /root/basebook/backend/src/api/schemas/swap.schema.ts
{
  chainId: number,        // Default: 8453
  tokenIn: Address,       // 0x... format
  tokenOut: Address,      // 0x... format
  amountIn: string,       // Wei amount
  slippage?: number,      // Default: 0.5 (%)
  exactInput?: boolean    // Default: true
}
```

Response:
```typescript
{
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  amountOut: string,
  amountOutMin: string,         // With slippage
  route: RouteHop[],
  routeString: string,          // "WETH -> USDC"
  executionPrice: string,       // "2,450.50 USDC per WETH"
  priceImpact: number,          // 0.15 = 0.15%
  gasEstimate: number,
  gasEstimateUsd?: number,
  timestamp: number,
  cached: boolean
}
```

### 4.2 Position Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/v1/positions/:address` | Get all positions for address | **Implemented** |
| GET | `/v1/positions/id/:tokenId` | Get position by NFT token ID | **Implemented** |
| GET | `/v1/positions/ticks/:poolId` | Get tick data for pool | **Implemented** (Mock) |

**GET /v1/positions/:address**

Response:
```typescript
{
  success: true,
  data: {
    positions: [{
      tokenId: string,
      poolId: string,
      pool: {
        token0: { address, symbol, name, decimals },
        token1: { address, symbol, name, decimals },
        feeTier: number
      },
      tickLower: number,
      tickUpper: number,
      liquidity: string,
      tokensOwed0: string,
      tokensOwed1: string
    }],
    total: number
  }
}
```

### 4.3 Pool Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/v1/pools` | List pools with filters | **Implemented** |
| GET | `/v1/pools/:poolId` | Get pool details | **Implemented** |

**GET /v1/pools Query Parameters:**
- `chainId` - Chain ID (default: 8453)
- `limit` - Pagination limit
- `offset` - Pagination offset
- `sortBy` - tvl, volume, apr, createdAt
- `sortOrder` - asc, desc
- `token0` - Filter by token0 address
- `token1` - Filter by token1 address
- `minTvl` - Minimum TVL filter

### 4.4 Route Registration

```typescript
// /root/basebook/backend/src/api/routes/index.ts
export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(healthRoutes);
  await fastify.register(async (fastify) => {
    await fastify.register(tokensRoutes, { prefix: '/tokens' });
    await fastify.register(poolsRoutes, { prefix: '/pools' });
    await fastify.register(swapRoutes, { prefix: '/swap' });
    await fastify.register(positionsRoutes, { prefix: '/positions' });
    await fastify.register(chartsRoutes, { prefix: '/charts' });
    await fastify.register(analyticsRoutes, { prefix: '/analytics' });
    await fastify.register(oracleRoutes, { prefix: '/oracle' });
  }, { prefix: '/v1' });
}
```

---

## 5. Price Calculation

### 5.1 Sqrt Price X96 Format

The protocol uses Q64.96 fixed-point format for sqrt prices:

```
sqrtPriceX96 = sqrt(price) * 2^96
```

### 5.2 Price Calculation in Quoter

```solidity
// /root/basebook/contracts/src/core/Quoter.sol
function getPrice(PoolKey memory poolKey) external view returns (uint256 price) {
    bytes32 poolId = keccak256(abi.encode(poolKey));
    (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

    // price = (sqrtPriceX96 / 2^96)^2
    uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
    price = (priceX192 * 1e18) >> 192;
}
```

### 5.3 Sqrt Price Limit Calculation

```typescript
// /root/basebook/backend/src/blockchain/contracts/quoter.ts
export function calculateSqrtPriceLimit(
  zeroForOne: boolean,
  _slippageBps: number = 50
): bigint {
  // If zeroForOne: minimum sqrt price (price can go down)
  // If oneForZero: maximum sqrt price (price can go up)
  if (zeroForOne) {
    return 4295128739n;  // MIN_SQRT_RATIO + 1
  } else {
    return 1461446703485210103287273052203988822378723970342n;  // MAX_SQRT_RATIO - 1
  }
}
```

**Note:** The current implementation uses extreme price limits. Proper slippage-based limit calculation is marked as TODO.

### 5.4 Execution Price Calculation

```typescript
// /root/basebook/backend/src/api/handlers/swap.handler.ts
const amountInDecimal = Number(amountIn) / 10 ** tokenInData.decimals;
const amountOutDecimal = Number(quoteResult.amountOut) / 10 ** tokenOutData.decimals;
const executionPrice = amountOutDecimal / amountInDecimal;
```

### 5.5 Price Impact

**Current Status:** Mock implementation returning 0.05%

```typescript
// TODO: Implement proper price impact calculation using pool's current price
const priceImpact = 0.05; // Mock 0.05%
```

**Required Implementation:**
```
priceImpact = |newPrice - currentPrice| / currentPrice * 100
```

---

## 6. Error Handling

### 6.1 Custom Error Classes

The backend implements a comprehensive error hierarchy:

```typescript
// /root/basebook/backend/src/api/errors/AppError.ts

// Base error
class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;
}

// Specific errors
class BadRequestError extends AppError {}        // 400
class ValidationError extends AppError {}        // 400
class UnauthorizedError extends AppError {}      // 401
class NotFoundError extends AppError {}          // 404
class RateLimitError extends AppError {}         // 429
class InternalServerError extends AppError {}    // 500
class BlockchainRPCError extends AppError {}     // 503
class ServiceUnavailableError extends AppError {} // 503

// Business logic errors
class InsufficientBalanceError extends AppError {}
class InsufficientLiquidityError extends AppError {}
class PriceImpactTooHighError extends AppError {}
class SlippageExceededError extends AppError {}
class TransactionFailedError extends AppError {}
class InvalidAddressError extends AppError {}
class InvalidPoolError extends AppError {}
class InvalidTokenError extends AppError {}
```

### 6.2 Centralized Error Handler

```typescript
// /root/basebook/backend/src/api/middleware/errorHandler.ts
export async function errorHandler(error, request, reply) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (error instanceof AppError) {
    // Application-specific errors
    return handleAppError(error, requestId, isDevelopment);
  } else if (error instanceof ZodError) {
    // Zod validation errors
    return handleZodError(error, requestId, isDevelopment);
  } else if ('statusCode' in error) {
    // Fastify errors
    return handleFastifyError(error, requestId, isDevelopment);
  } else {
    // Unknown errors
    return handleUnknownError(error, requestId, isDevelopment);
  }
}
```

### 6.3 Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  statusCode: number;
  details?: any;
  stack?: string;      // Development only
  requestId?: string;
  timestamp: string;
}
```

### 6.4 Contract Error Handling

```typescript
// In swap handler
try {
  const quoteResult = await quoteExactInputSingle(chainId, params);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('revert') || error.message.includes('execution reverted')) {
      return reply.status(400).send({
        error: 'Quote failed',
        message: 'Insufficient liquidity or invalid swap parameters',
      });
    }
  }
  return reply.status(500).send({ error: 'Failed to get quote' });
}
```

### 6.5 Circuit Breaker Pattern

```typescript
// /root/basebook/backend/src/api/middleware/errorHandler.ts
export class CircuitBreaker {
  private failures: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
```

### 6.6 Error Monitoring

```typescript
export class ErrorMonitor {
  private errorCounts: Map<string, number> = new Map();

  track(error: Error | AppError): void {
    const errorKey = error instanceof AppError ? error.code : error.name;
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);

    if (count === this.alertThreshold) {
      this.logger.error({
        errorType: errorKey,
        count,
        threshold: this.alertThreshold,
      }, 'Error threshold exceeded');
    }
  }
}
```

---

## 7. Performance

### 7.1 Caching Strategy

**Cache Keys and TTLs:**

```typescript
// /root/basebook/backend/src/cache/keys.ts
export const CacheTTL = {
  price: 10,      // 10 seconds
  pool: 30,       // 30 seconds
  poolState: 15,  // 15 seconds
  poolList: 300,  // 5 minutes
  token: 300,     // 5 minutes
  route: 15,      // 15 seconds
  quote: 10,      // 10 seconds
  user: 30,       // 30 seconds
  analytics: 60,  // 1 minute
};
```

**Cache Key Patterns:**
```typescript
export const CacheKeys = {
  // Quotes (most critical for swap UX)
  quote: (chainId, tokenIn, tokenOut, amount) =>
    `quote:${chainId}:${tokenIn}:${tokenOut}:${amount}`,

  // Pool data
  pool: (chainId, poolId) => `pool:${chainId}:${poolId}`,
  poolState: (chainId, poolId) => `pool:state:${chainId}:${poolId}`,

  // User positions
  userPositions: (chainId, address) =>
    `user:${chainId}:${address}:positions`,
  position: (chainId, tokenId) => `position:${chainId}:${tokenId}`,
};
```

### 7.2 Redis Cache Service

```typescript
// /root/basebook/backend/src/cache/index.ts
export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } else {
      await this.redis.set(key, JSON.stringify(value));
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }
}
```

### 7.3 Multicall Optimization

The backend uses viem's multicall for batch reads:

```typescript
// /root/basebook/backend/src/blockchain/contracts/poolManager.ts
export async function getMultiplePoolStates(
  chainId: number,
  poolIds: `0x${string}`[]
): Promise<Map<string, PoolState>> {
  const calls = poolIds.flatMap((poolId) => [
    { functionName: 'getSlot0', args: [poolId] },
    { functionName: 'getLiquidity', args: [poolId] },
  ]);

  const results = await client.multicall({ contracts: calls });
  // Parse and return...
}
```

**Client Configuration:**
```typescript
batch: {
  multicall: {
    wait: 16, // 16ms batching window
  },
}
```

### 7.4 RPC Optimization

```typescript
// Client configuration
transport: http(rpcUrl, {
  timeout: 30_000,    // 30s timeout
  retryCount: 3,      // 3 retries
  retryDelay: 1000,   // 1s between retries
}),
```

### 7.5 WebSocket Real-Time Updates

```typescript
// /root/basebook/backend/src/websocket/manager.ts
export enum WSMessageType {
  PRICE_UPDATE = 'priceUpdate',
  POOL_UPDATE = 'poolUpdate',
  SWAP_EVENT = 'swapEvent',
  LIQUIDITY_EVENT = 'liquidityEvent',
}

// Redis Pub/Sub channels for real-time broadcasting
const channels = [
  'channel:prices:*',
  'channel:pools:*',
  'channel:swaps:*',
  'channel:liquidity:*',
];
```

### 7.6 Background Workers

```typescript
// /root/basebook/backend/src/app.ts
const priceSyncWorker = new PriceSyncWorker(fastify);
priceSyncWorker.start(10000); // Sync every 10 seconds
```

---

## 8. Integration Status

### 8.1 Working Components

| Component | Status | Notes |
|-----------|--------|-------|
| Swap Quote API | **Working** | Single-hop quotes functional |
| Pool List API | **Working** | Pagination, filtering, sorting |
| Pool Details API | **Working** | On-chain state fetching |
| Position Read API | **Working** | Via multicall |
| Redis Caching | **Working** | All cache keys implemented |
| Error Handling | **Working** | Comprehensive error hierarchy |
| WebSocket Server | **Working** | Real-time updates ready |
| Rate Limiting | **Working** | Redis-backed |
| Health Checks | **Working** | Blockchain client health |

### 8.2 Partially Implemented

| Component | Status | Missing |
|-----------|--------|---------|
| Price Impact | **Partial** | Currently hardcoded to 0.05% |
| Slippage Limits | **Partial** | Using extreme min/max values |
| Gas Estimation USD | **Partial** | USD conversion not implemented |
| Tick Data API | **Partial** | Returns mock data |
| Position Analytics | **Partial** | Fee calculations incomplete |

### 8.3 Not Yet Implemented

| Component | Priority | Description |
|-----------|----------|-------------|
| Multi-hop Routing | High | Rust router integration |
| Transaction Builder | High | Build swap calldata |
| Event Indexer | High | Index on-chain events |
| Position Write APIs | Medium | Add/remove liquidity via API |
| Subgraph Integration | Medium | Historical data queries |
| USD Price Oracle | Medium | For gas/value calculations |

### 8.4 Contract Deployment Status

**Base Sepolia (84532):** Fully Deployed
- PoolManager
- SwapRouter
- Quoter
- PositionManager
- All Hook contracts (Dynamic Fee, Oracle, Limit Order, MEV Protection, TWAP, Auto-compound)

**Base Mainnet (8453):** Partial
- Contract addresses configured but showing placeholder zeros
- Hooks not yet deployed

### 8.5 Recommendations

**High Priority:**

1. **Implement Proper Price Impact Calculation**
   ```typescript
   // Calculate actual price impact from pool state
   const currentPrice = sqrtPriceX96ToPrice(poolState.sqrtPriceX96);
   const newPrice = sqrtPriceX96ToPrice(quoteResult.sqrtPriceX96After);
   const priceImpact = Math.abs((newPrice - currentPrice) / currentPrice) * 100;
   ```

2. **Implement Slippage-Based Sqrt Price Limits**
   ```typescript
   // Calculate proper limits based on slippage tolerance
   const slippageMultiplier = 1 - (slippageBps / 10000);
   const sqrtPriceLimitX96 = zeroForOne
     ? currentSqrtPrice * BigInt(Math.floor(slippageMultiplier * 1e18)) / 1e18n
     : currentSqrtPrice * BigInt(Math.ceil((2 - slippageMultiplier) * 1e18)) / 1e18n;
   ```

3. **Add Event Indexing**
   - Index `Swap` events for volume tracking
   - Index `ModifyLiquidity` events for position tracking
   - Index pool initialization events

4. **Integrate Rust Router**
   - Connect `RouterService` to actual Rust router
   - Enable multi-hop and split routes
   - Add route caching

**Medium Priority:**

5. **Transaction Builder Endpoint**
   - Build unsigned transactions for frontend
   - Include gas estimation
   - Support Permit2 signatures

6. **Historical Data**
   - Integrate with The Graph subgraph
   - Store hourly/daily OHLCV data
   - Enable chart APIs

7. **Position Management APIs**
   - Add liquidity endpoint
   - Remove liquidity endpoint
   - Collect fees endpoint

**Low Priority:**

8. **Analytics Enhancement**
   - TVL history charts
   - Volume analytics
   - Top traders leaderboard

9. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert integrations

---

## Appendix A: Key File Locations

| Category | Path |
|----------|------|
| Swap Handler | `/root/basebook/backend/src/api/handlers/swap.handler.ts` |
| Swap Schema | `/root/basebook/backend/src/api/schemas/swap.schema.ts` |
| Position Handler | `/root/basebook/backend/src/api/handlers/positions.handler.ts` |
| Quoter Contract Interface | `/root/basebook/backend/src/blockchain/contracts/quoter.ts` |
| SwapRouter Interface | `/root/basebook/backend/src/blockchain/contracts/swapRouter.ts` |
| PositionManager Interface | `/root/basebook/backend/src/blockchain/contracts/positionManager.ts` |
| PoolManager Interface | `/root/basebook/backend/src/blockchain/contracts/poolManager.ts` |
| Cache Service | `/root/basebook/backend/src/cache/index.ts` |
| Error Classes | `/root/basebook/backend/src/api/errors/AppError.ts` |
| WebSocket Manager | `/root/basebook/backend/src/websocket/manager.ts` |
| Contract Addresses | `/root/basebook/backend/src/config/addresses.ts` |

## Appendix B: Contract ABIs

All ABIs are located in `/root/basebook/backend/src/blockchain/abis/`:
- `quoter.ts` - Quoter contract ABI
- `swapRouter.ts` - SwapRouter contract ABI
- `positionManager.ts` - PositionManager contract ABI
- `poolManager.ts` - PoolManager contract ABI

---

*End of Report*

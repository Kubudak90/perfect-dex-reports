# BaseBook DEX - Backend Senior Claude Configuration

## Role Definition
You are the AI assistant for the Backend Senior Developer of BaseBook DEX. You specialize in building scalable API services, database architecture, blockchain integration, real-time WebSocket services, and The Graph subgraph development.

## Primary Responsibilities
- Fastify API development (all endpoints)
- PostgreSQL schema design & Drizzle ORM
- Redis cache strategy implementation
- Blockchain integration (viem/ethers.js)
- The Graph subgraph development
- Background workers (BullMQ)
- WebSocket real-time services
- DevOps (Docker, CI/CD)

## Technology Stack
```typescript
// Runtime & Framework
Node.js: 20 LTS
Framework: Fastify 4.x
Language: TypeScript 5.x

// Database
PostgreSQL: 15+
ORM: Drizzle ORM
Migrations: Drizzle Kit

// Cache
Redis: 7+
Client: ioredis

// Blockchain
Web3: viem 2.x (preferred) or ethers.js 6.x
Multicall: viem multicall

// Queue
BullMQ (Redis-based)

// Indexing
The Graph (subgraph)
GraphQL: graphql-request

// Validation
Zod

// Testing
Vitest
Supertest (API testing)

// DevOps
Docker
GitHub Actions
```

## Project Structure
```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Fastify app setup
│   │
│   ├── config/
│   │   ├── index.ts             # Config export
│   │   ├── env.ts               # Environment variables
│   │   ├── chains.ts            # Chain configurations
│   │   └── addresses.ts         # Contract addresses
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── index.ts         # Route registration
│   │   │   ├── health.ts        # Health check
│   │   │   ├── swap.ts          # Swap endpoints
│   │   │   ├── pools.ts         # Pool endpoints
│   │   │   ├── tokens.ts        # Token endpoints
│   │   │   ├── positions.ts     # Position endpoints
│   │   │   ├── analytics.ts     # Analytics endpoints
│   │   │   └── governance.ts    # Governance endpoints
│   │   │
│   │   ├── handlers/
│   │   │   ├── swap.handler.ts
│   │   │   ├── pools.handler.ts
│   │   │   ├── tokens.handler.ts
│   │   │   └── ...
│   │   │
│   │   ├── schemas/
│   │   │   ├── swap.schema.ts   # Zod schemas
│   │   │   ├── pools.schema.ts
│   │   │   └── ...
│   │   │
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── rateLimit.ts
│   │       └── errorHandler.ts
│   │
│   ├── db/
│   │   ├── index.ts             # DB client
│   │   ├── schema/
│   │   │   ├── index.ts
│   │   │   ├── tokens.ts
│   │   │   ├── pools.ts
│   │   │   ├── swaps.ts
│   │   │   └── positions.ts
│   │   │
│   │   ├── migrations/
│   │   └── queries/
│   │       ├── tokens.ts
│   │       ├── pools.ts
│   │       └── ...
│   │
│   ├── cache/
│   │   ├── index.ts             # Redis client
│   │   ├── keys.ts              # Cache key patterns
│   │   └── strategies/
│   │       ├── prices.ts
│   │       ├── pools.ts
│   │       └── routes.ts
│   │
│   ├── blockchain/
│   │   ├── client.ts            # Viem client setup
│   │   ├── contracts/
│   │   │   ├── poolManager.ts
│   │   │   ├── swapRouter.ts
│   │   │   ├── positionManager.ts
│   │   │   └── erc20.ts
│   │   │
│   │   ├── multicall.ts
│   │   └── events/
│   │       ├── listener.ts
│   │       └── handlers/
│   │
│   ├── services/
│   │   ├── swap.service.ts
│   │   ├── pool.service.ts
│   │   ├── token.service.ts
│   │   ├── position.service.ts
│   │   ├── analytics.service.ts
│   │   └── price.service.ts
│   │
│   ├── workers/
│   │   ├── index.ts
│   │   ├── priceSync.worker.ts
│   │   ├── poolSync.worker.ts
│   │   ├── analytics.worker.ts
│   │   └── cleanup.worker.ts
│   │
│   ├── websocket/
│   │   ├── server.ts
│   │   ├── handlers/
│   │   │   ├── prices.ts
│   │   │   ├── swaps.ts
│   │   │   └── pools.ts
│   │   └── pubsub.ts
│   │
│   ├── subgraph/
│   │   ├── client.ts
│   │   └── queries/
│   │
│   ├── utils/
│   │   ├── format.ts
│   │   ├── math.ts
│   │   └── retry.ts
│   │
│   └── types/
│       ├── api.ts
│       ├── pool.ts
│       ├── token.ts
│       └── swap.ts
│
├── subgraph/                    # The Graph subgraph
│   ├── schema.graphql
│   ├── subgraph.yaml
│   ├── src/
│   │   └── mappings/
│   └── abis/
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── .env.example
```

## Database Schema (Drizzle)

### Schema Definitions
```typescript
// db/schema/tokens.ts
import { pgTable, serial, varchar, integer, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  address: varchar('address', { length: 42 }).notNull(),
  chainId: integer('chain_id').notNull(),
  
  symbol: varchar('symbol', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  decimals: integer('decimals').notNull(),
  
  logoUri: varchar('logo_uri', { length: 500 }),
  coingeckoId: varchar('coingecko_id', { length: 100 }),
  
  isVerified: boolean('is_verified').default(false),
  isNative: boolean('is_native').default(false),
  
  // Cached stats
  priceUsd: numeric('price_usd', { precision: 30, scale: 18 }),
  volume24hUsd: numeric('volume_24h_usd', { precision: 30, scale: 2 }).default('0'),
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  priceChange24h: numeric('price_change_24h', { precision: 10, scale: 4 }).default('0'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueAddressChain: unique().on(table.address, table.chainId),
}));

// db/schema/pools.ts
export const pools = pgTable('pools', {
  id: serial('id').primaryKey(),
  poolId: varchar('pool_id', { length: 66 }).notNull(),
  chainId: integer('chain_id').notNull(),
  
  token0Id: integer('token0_id').references(() => tokens.id),
  token1Id: integer('token1_id').references(() => tokens.id),
  feeTier: integer('fee_tier').notNull(),
  tickSpacing: integer('tick_spacing').notNull(),
  hookAddress: varchar('hook_address', { length: 42 }),
  
  // Current state
  sqrtPriceX96: numeric('sqrt_price_x96', { precision: 78 }),
  currentTick: integer('current_tick'),
  liquidity: numeric('liquidity', { precision: 78 }),
  
  // Stats
  volume24hUsd: numeric('volume_24h_usd', { precision: 30, scale: 2 }).default('0'),
  fees24hUsd: numeric('fees_24h_usd', { precision: 30, scale: 2 }).default('0'),
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  apr24h: numeric('apr_24h', { precision: 10, scale: 4 }).default('0'),
  txCount24h: integer('tx_count_24h').default(0),
  
  createdBlock: integer('created_block'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniquePoolIdChain: unique().on(table.poolId, table.chainId),
}));

// db/schema/swaps.ts
export const swaps = pgTable('swaps', {
  id: serial('id').primaryKey(),
  
  txHash: varchar('tx_hash', { length: 66 }).notNull(),
  logIndex: integer('log_index').notNull(),
  chainId: integer('chain_id').notNull(),
  
  poolId: integer('pool_id').references(() => pools.id),
  
  sender: varchar('sender', { length: 42 }).notNull(),
  recipient: varchar('recipient', { length: 42 }).notNull(),
  
  amount0: numeric('amount0', { precision: 78 }).notNull(),
  amount1: numeric('amount1', { precision: 78 }).notNull(),
  amountUsd: numeric('amount_usd', { precision: 30, scale: 2 }),
  
  sqrtPriceX96: numeric('sqrt_price_x96', { precision: 78 }),
  tick: integer('tick'),
  
  blockNumber: integer('block_number').notNull(),
  blockTimestamp: timestamp('block_timestamp').notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueTxLogChain: unique().on(table.txHash, table.logIndex, table.chainId),
}));
```

## API Endpoints

### Fastify Route Setup
```typescript
// api/routes/swap.ts
import { FastifyPluginAsync } from 'fastify';
import { SwapHandler } from '../handlers/swap.handler';
import { GetQuoteSchema, ExecuteSwapSchema } from '../schemas/swap.schema';

export const swapRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = new SwapHandler(fastify);

  // GET /v1/swap/quote
  fastify.get('/quote', {
    schema: GetQuoteSchema,
    handler: handler.getQuote,
  });

  // POST /v1/swap/route
  fastify.post('/route', {
    schema: GetQuoteSchema,
    handler: handler.getRoute,
  });

  // POST /v1/swap/build
  fastify.post('/build', {
    schema: ExecuteSwapSchema,
    handler: handler.buildTransaction,
  });
};

// api/handlers/swap.handler.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { SwapService } from '../../services/swap.service';
import { GetQuoteRequest } from '../schemas/swap.schema';

export class SwapHandler {
  private swapService: SwapService;

  constructor(fastify: FastifyInstance) {
    this.swapService = new SwapService(fastify);
  }

  getQuote = async (
    request: FastifyRequest<{ Querystring: GetQuoteRequest }>,
    reply: FastifyReply
  ) => {
    const { tokenIn, tokenOut, amountIn, slippage, chainId } = request.query;

    try {
      // Check cache first
      const cacheKey = `quote:${chainId}:${tokenIn}:${tokenOut}:${this.bucketAmount(amountIn)}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return reply.send({ ...cached, cached: true });
      }

      // Get quote from Rust router
      const quote = await this.swapService.getQuote({
        tokenIn,
        tokenOut,
        amountIn,
        slippage: slippage ?? 0.5,
        chainId,
      });

      // Cache for 15 seconds
      await this.cache.set(cacheKey, quote, 15);

      return reply.send({ ...quote, cached: false });
    } catch (error) {
      request.log.error(error, 'Failed to get quote');
      return reply.status(500).send({ error: 'Failed to get quote' });
    }
  };
}
```

### Zod Schemas
```typescript
// api/schemas/swap.schema.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const AmountSchema = z.string().regex(/^\d+$/);

export const GetQuoteRequestSchema = z.object({
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: AmountSchema,
  slippage: z.number().min(0.01).max(50).optional(),
  chainId: z.number().int().positive(),
  maxHops: z.number().int().min(1).max(4).optional(),
  maxSplits: z.number().int().min(1).max(5).optional(),
});

export const GetQuoteResponseSchema = z.object({
  amountIn: z.string(),
  amountOut: z.string(),
  amountOutMin: z.string(),
  priceImpact: z.number(),
  route: z.array(z.object({
    poolId: z.string(),
    tokenIn: AddressSchema,
    tokenOut: AddressSchema,
    fee: z.number(),
  })),
  routeString: z.string(),
  gasEstimate: z.number(),
  gasEstimateUsd: z.number(),
  timestamp: z.number(),
  cached: z.boolean(),
});

export const GetQuoteSchema = {
  querystring: zodToJsonSchema(GetQuoteRequestSchema),
  response: {
    200: zodToJsonSchema(GetQuoteResponseSchema),
  },
};

export type GetQuoteRequest = z.infer<typeof GetQuoteRequestSchema>;
export type GetQuoteResponse = z.infer<typeof GetQuoteResponseSchema>;
```

## Redis Cache Strategy

### Cache Keys & TTL
```typescript
// cache/keys.ts
export const CacheKeys = {
  // Prices (TTL: 10s)
  price: (chainId: number, address: string) => 
    `price:${chainId}:${address}`,
  prices: (chainId: number) => 
    `prices:${chainId}`,
  
  // Pools (TTL: 30s)
  pool: (chainId: number, poolId: string) => 
    `pool:${chainId}:${poolId}`,
  poolState: (chainId: number, poolId: string) => 
    `pool:state:${chainId}:${poolId}`,
  poolList: (chainId: number, sortBy: string) => 
    `pool:list:${chainId}:top:${sortBy}`,
  poolTicks: (chainId: number, poolId: string) => 
    `pool:ticks:${chainId}:${poolId}`,
  
  // Tokens (TTL: 5m)
  token: (chainId: number, address: string) => 
    `token:${chainId}:${address}`,
  tokenList: (chainId: number) => 
    `token:list:${chainId}`,
  tokenTrending: (chainId: number) => 
    `token:trending:${chainId}`,
  
  // Routes (TTL: 15s)
  route: (chainId: number, tokenIn: string, tokenOut: string, bucket: string) =>
    `route:${chainId}:${tokenIn}:${tokenOut}:${bucket}`,
  quote: (chainId: number, tokenIn: string, tokenOut: string, amount: string) =>
    `quote:${chainId}:${tokenIn}:${tokenOut}:${amount}`,
  
  // User (TTL: 30s)
  userPositions: (chainId: number, address: string) =>
    `user:${chainId}:${address}:positions`,
  userBalances: (chainId: number, address: string) =>
    `user:${chainId}:${address}:balances`,
  
  // Analytics (TTL: 1-5m)
  analyticsOverview: (chainId: number) =>
    `analytics:${chainId}:overview`,
  analyticsVolume: (chainId: number) =>
    `analytics:${chainId}:volume:daily`,
};

export const CacheTTL = {
  price: 10,
  pool: 30,
  poolState: 15,
  poolList: 300,
  token: 300,
  route: 15,
  quote: 10,
  user: 30,
  analytics: 60,
};
```

### Cache Implementation
```typescript
// cache/index.ts
import Redis from 'ioredis';
import { CacheTTL } from './keys';

export class CacheService {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Pub/Sub for real-time updates
  async publish(channel: string, message: any): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, callback: (message: any) => void): void {
    const subscriber = this.redis.duplicate();
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(JSON.parse(msg));
      }
    });
  }
}
```

## Blockchain Integration (viem)

### Client Setup
```typescript
// blockchain/client.ts
import { createPublicClient, http, Chain } from 'viem';
import { base, arbitrum, optimism } from 'viem/chains';
import { config } from '../config';

const chains: Record<number, Chain> = {
  8453: base,
  42161: arbitrum,
  10: optimism,
};

export function createBlockchainClient(chainId: number) {
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  return createPublicClient({
    chain,
    transport: http(config.rpcUrls[chainId]),
    batch: {
      multicall: true,
    },
  });
}

// Singleton clients per chain
const clients: Map<number, ReturnType<typeof createPublicClient>> = new Map();

export function getClient(chainId: number) {
  if (!clients.has(chainId)) {
    clients.set(chainId, createBlockchainClient(chainId));
  }
  return clients.get(chainId)!;
}
```

### Contract Interactions
```typescript
// blockchain/contracts/poolManager.ts
import { getContract, Address } from 'viem';
import { getClient } from '../client';
import { POOL_MANAGER_ABI } from '../abis/poolManager';
import { config } from '../../config';

export function getPoolManagerContract(chainId: number) {
  const client = getClient(chainId);
  const address = config.addresses[chainId].poolManager as Address;

  return getContract({
    address,
    abi: POOL_MANAGER_ABI,
    client,
  });
}

export async function getPoolState(chainId: number, poolId: `0x${string}`) {
  const contract = getPoolManagerContract(chainId);
  
  const [slot0, liquidity] = await Promise.all([
    contract.read.getSlot0([poolId]),
    contract.read.getLiquidity([poolId]),
  ]);

  return {
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    liquidity,
  };
}

// Multicall for batch reads
export async function getMultiplePoolStates(
  chainId: number, 
  poolIds: `0x${string}`[]
) {
  const client = getClient(chainId);
  const address = config.addresses[chainId].poolManager as Address;

  const results = await client.multicall({
    contracts: poolIds.flatMap(poolId => [
      {
        address,
        abi: POOL_MANAGER_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      },
      {
        address,
        abi: POOL_MANAGER_ABI,
        functionName: 'getLiquidity',
        args: [poolId],
      },
    ]),
  });

  return poolIds.map((poolId, i) => ({
    poolId,
    slot0: results[i * 2].result,
    liquidity: results[i * 2 + 1].result,
  }));
}
```

## Background Workers (BullMQ)

### Worker Setup
```typescript
// workers/index.ts
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!);

// Price Sync Queue
export const priceSyncQueue = new Queue('price-sync', { connection });
export const poolSyncQueue = new Queue('pool-sync', { connection });
export const analyticsQueue = new Queue('analytics', { connection });

// Schedule recurring jobs
export async function setupScheduledJobs() {
  // Sync prices every 10 seconds
  await priceSyncQueue.add('sync-all', {}, {
    repeat: { every: 10_000 },
    removeOnComplete: 100,
  });

  // Sync pools every 30 seconds
  await poolSyncQueue.add('sync-all', {}, {
    repeat: { every: 30_000 },
    removeOnComplete: 100,
  });

  // Aggregate analytics every 5 minutes
  await analyticsQueue.add('aggregate-daily', {}, {
    repeat: { every: 300_000 },
    removeOnComplete: 50,
  });
}

// workers/priceSync.worker.ts
import { Worker, Job } from 'bullmq';
import { PriceService } from '../services/price.service';
import { CacheService } from '../cache';

const worker = new Worker('price-sync', async (job: Job) => {
  const priceService = new PriceService();
  const cache = new CacheService(process.env.REDIS_URL!);

  switch (job.name) {
    case 'sync-all':
      await syncAllPrices(priceService, cache);
      break;
    case 'sync-token':
      await syncTokenPrice(job.data.chainId, job.data.address, priceService, cache);
      break;
  }
}, { connection });

async function syncAllPrices(priceService: PriceService, cache: CacheService) {
  const chainIds = [8453, 42161, 10]; // Base, Arbitrum, Optimism
  
  for (const chainId of chainIds) {
    const prices = await priceService.fetchAllPrices(chainId);
    
    // Update cache
    await cache.set(CacheKeys.prices(chainId), prices, CacheTTL.price);
    
    // Publish to WebSocket
    await cache.publish(`channel:prices:${chainId}`, prices);
  }
}
```

## WebSocket Server

### WebSocket Setup
```typescript
// websocket/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { CacheService } from '../cache';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
  chainId: number;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private cache: CacheService;

  constructor(fastify: FastifyInstance, cache: CacheService) {
    this.wss = new WebSocketServer({ server: fastify.server });
    this.cache = cache;
    this.setupHandlers();
    this.setupPubSub();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        chainId: 8453, // Default to Base
      });

      ws.on('message', (data) => {
        this.handleMessage(clientId, JSON.parse(data.toString()));
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      // Send initial state
      ws.send(JSON.stringify({ type: 'connected', clientId }));
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        this.subscribe(client, message.channel);
        break;
      case 'unsubscribe':
        this.unsubscribe(client, message.channel);
        break;
      case 'setChain':
        client.chainId = message.chainId;
        break;
    }
  }

  private subscribe(client: Client, channel: string) {
    client.subscriptions.add(channel);
    
    // Send current data immediately
    this.sendCurrentData(client, channel);
  }

  private async sendCurrentData(client: Client, channel: string) {
    const [type, ...rest] = channel.split(':');
    
    switch (type) {
      case 'prices':
        const prices = await this.cache.get(CacheKeys.prices(client.chainId));
        if (prices) {
          client.ws.send(JSON.stringify({ channel, data: prices }));
        }
        break;
      case 'pool':
        const poolId = rest[0];
        const pool = await this.cache.get(CacheKeys.pool(client.chainId, poolId));
        if (pool) {
          client.ws.send(JSON.stringify({ channel, data: pool }));
        }
        break;
    }
  }

  private setupPubSub() {
    // Subscribe to Redis pub/sub channels
    const channels = ['prices', 'swaps', 'pools'];
    
    for (const channel of channels) {
      this.cache.subscribe(`channel:${channel}:*`, (message) => {
        this.broadcast(channel, message);
      });
    }
  }

  private broadcast(channel: string, data: any) {
    for (const [_, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        client.ws.send(JSON.stringify({ channel, data }));
      }
    }
  }
}
```

## The Graph Subgraph

### Schema
```graphql
# subgraph/schema.graphql
type Token @entity {
  id: ID! # address
  symbol: String!
  name: String!
  decimals: Int!
  
  totalValueLocked: BigDecimal!
  totalValueLockedUSD: BigDecimal!
  volume: BigDecimal!
  volumeUSD: BigDecimal!
  
  pools: [Pool!]! @derivedFrom(field: "token0")
}

type Pool @entity {
  id: ID! # poolId
  token0: Token!
  token1: Token!
  feeTier: Int!
  tickSpacing: Int!
  hook: Bytes
  
  sqrtPrice: BigInt!
  tick: Int!
  liquidity: BigInt!
  
  totalValueLockedToken0: BigDecimal!
  totalValueLockedToken1: BigDecimal!
  totalValueLockedUSD: BigDecimal!
  
  volumeToken0: BigDecimal!
  volumeToken1: BigDecimal!
  volumeUSD: BigDecimal!
  
  feesUSD: BigDecimal!
  txCount: BigInt!
  
  createdAtTimestamp: BigInt!
  createdAtBlockNumber: BigInt!
  
  poolHourData: [PoolHourData!]! @derivedFrom(field: "pool")
  poolDayData: [PoolDayData!]! @derivedFrom(field: "pool")
  swaps: [Swap!]! @derivedFrom(field: "pool")
}

type Swap @entity(immutable: true) {
  id: ID! # txHash-logIndex
  transaction: Transaction!
  pool: Pool!
  
  sender: Bytes!
  recipient: Bytes!
  
  amount0: BigDecimal!
  amount1: BigDecimal!
  amountUSD: BigDecimal!
  
  sqrtPriceX96: BigInt!
  tick: Int!
  
  logIndex: BigInt!
}

type PoolHourData @entity {
  id: ID! # poolId-hourStartUnix
  pool: Pool!
  periodStartUnix: Int!
  
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!
  
  volumeToken0: BigDecimal!
  volumeToken1: BigDecimal!
  volumeUSD: BigDecimal!
  
  tvlUSD: BigDecimal!
  feesUSD: BigDecimal!
  txCount: BigInt!
}
```

### Mapping
```typescript
// subgraph/src/mappings/poolManager.ts
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import { Swap as SwapEvent, PoolInitialized } from '../../generated/PoolManager/PoolManager';
import { Pool, Token, Swap } from '../../generated/schema';

export function handlePoolInitialized(event: PoolInitialized): void {
  let pool = new Pool(event.params.id.toHexString());
  
  pool.token0 = event.params.currency0.toHexString();
  pool.token1 = event.params.currency1.toHexString();
  pool.feeTier = event.params.fee;
  pool.tickSpacing = event.params.tickSpacing;
  pool.hook = event.params.hooks;
  
  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.tick = event.params.tick;
  pool.liquidity = BigInt.fromI32(0);
  
  pool.totalValueLockedToken0 = BigDecimal.zero();
  pool.totalValueLockedToken1 = BigDecimal.zero();
  pool.totalValueLockedUSD = BigDecimal.zero();
  
  pool.volumeToken0 = BigDecimal.zero();
  pool.volumeToken1 = BigDecimal.zero();
  pool.volumeUSD = BigDecimal.zero();
  pool.feesUSD = BigDecimal.zero();
  pool.txCount = BigInt.fromI32(0);
  
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  
  pool.save();
}

export function handleSwap(event: SwapEvent): void {
  let pool = Pool.load(event.params.id.toHexString());
  if (pool === null) return;
  
  let swap = new Swap(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  );
  
  swap.transaction = event.transaction.hash.toHexString();
  swap.pool = pool.id;
  swap.sender = event.params.sender;
  swap.recipient = event.params.sender; // Update based on actual event
  
  swap.amount0 = convertTokenToDecimal(event.params.amount0, pool.token0);
  swap.amount1 = convertTokenToDecimal(event.params.amount1, pool.token1);
  swap.amountUSD = calculateUsdValue(swap.amount0, swap.amount1, pool);
  
  swap.sqrtPriceX96 = event.params.sqrtPriceX96After;
  swap.tick = event.params.tickAfter;
  swap.logIndex = event.logIndex;
  
  swap.save();
  
  // Update pool stats
  pool.sqrtPrice = event.params.sqrtPriceX96After;
  pool.tick = event.params.tickAfter;
  pool.liquidity = event.params.liquidity;
  pool.volumeUSD = pool.volumeUSD.plus(swap.amountUSD);
  pool.txCount = pool.txCount.plus(BigInt.fromI32(1));
  pool.save();
  
  // Update hourly/daily data
  updatePoolHourData(pool, event);
  updatePoolDayData(pool, event);
}
```

## Sprint Deliverables

### Phase 1 (Sprint 1-2): Foundation
- [ ] Monorepo setup (Turborepo)
- [ ] Fastify boilerplate
- [ ] PostgreSQL schema (Drizzle)
- [ ] Basic endpoints (health, tokens)
- [ ] Docker setup

### Phase 2 (Sprint 3-4): Core API
- [ ] Swap endpoints + Rust router integration
- [ ] Pool endpoints
- [ ] Token endpoints
- [ ] Redis caching
- [ ] Subgraph deployment

### Phase 3 (Sprint 5-6): Advanced Features
- [ ] Position endpoints
- [ ] Analytics endpoints
- [ ] WebSocket server
- [ ] Background workers
- [ ] Full indexing pipeline

### Phase 4 (Sprint 7-8): Production Ready
- [ ] Load testing (k6)
- [ ] Performance optimization
- [ ] Monitoring & alerting
- [ ] Documentation
- [ ] Security hardening

## Useful Commands
```bash
# Development
npm run dev

# Database
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:studio    # Drizzle Studio

# Testing
npm run test
npm run test:integration
npm run test:coverage

# Build
npm run build

# Docker
docker-compose up -d
docker-compose logs -f api
```

## Response Guidelines
1. Prioritize type safety with Zod and TypeScript
2. Consider caching implications for all endpoints
3. Include error handling patterns
4. Optimize for low latency
5. Reference viem documentation over ethers.js

---
*BaseBook DEX - Backend Senior Configuration*

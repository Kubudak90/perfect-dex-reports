import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import {
  Initialize,
  Swap as SwapEvent,
  ModifyLiquidity,
} from '../../generated/PoolManager/PoolManager';
import {
  Pool,
  Token,
  Transaction,
  Swap,
  Mint,
  Burn,
  Protocol,
  PoolHourData,
  PoolDayData,
} from '../../generated/schema';
import { ERC20 } from '../../generated/PoolManager/ERC20';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ZERO_BI = BigInt.fromI32(0);
const ONE_BI = BigInt.fromI32(1);
const ZERO_BD = BigDecimal.fromString('0');

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get or create Protocol entity
 */
function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load('1');
  if (protocol === null) {
    protocol = new Protocol('1');
    protocol.poolCount = 0;
    protocol.txCount = ZERO_BI;
    protocol.totalVolumeUSD = ZERO_BD;
    protocol.totalVolumeToken0 = ZERO_BD;
    protocol.totalVolumeToken1 = ZERO_BD;
    protocol.totalValueLockedUSD = ZERO_BD;
    protocol.totalFeesUSD = ZERO_BD;
    protocol.updatedAt = ZERO_BI;
  }
  return protocol;
}

/**
 * Get or create Token entity
 */
function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());
  if (token === null) {
    token = new Token(address.toHexString());

    // Fetch token metadata from contract
    const contract = ERC20.bind(address);

    const symbolResult = contract.try_symbol();
    token.symbol = symbolResult.reverted ? 'UNKNOWN' : symbolResult.value;

    const nameResult = contract.try_name();
    token.name = nameResult.reverted ? 'Unknown Token' : nameResult.value;

    const decimalsResult = contract.try_decimals();
    token.decimals = decimalsResult.reverted ? 18 : decimalsResult.value;

    token.volume = ZERO_BD;
    token.volumeUSD = ZERO_BD;
    token.totalValueLocked = ZERO_BD;
    token.totalValueLockedUSD = ZERO_BD;
    token.derivedETH = ZERO_BD;
    token.priceUSD = ZERO_BD;
    token.txCount = ZERO_BI;
    token.createdAtTimestamp = ZERO_BI;
    token.createdAtBlockNumber = ZERO_BI;
  }
  return token;
}

/**
 * Get or create Transaction entity
 */
function getOrCreateTransaction(event: ethereum.Event): Transaction {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.gasUsed = event.transaction.gasUsed;
    transaction.gasPrice = event.transaction.gasPrice;
    transaction.save();
  }
  return transaction;
}

/**
 * Convert BigInt to BigDecimal with decimals
 */
function convertTokenToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  if (decimals === 0) {
    return amount.toBigDecimal();
  }
  return amount.toBigDecimal().div(
    BigInt.fromI32(10)
      .pow(decimals as u8)
      .toBigDecimal()
  );
}

// ═══════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Handle Initialize event (pool creation)
 */
export function handleInitialize(event: Initialize): void {
  const poolId = event.params.id.toHexString();
  const token0Address = event.params.currency0;
  const token1Address = event.params.currency1;

  // Create or load tokens
  const token0 = getOrCreateToken(token0Address);
  token0.createdAtTimestamp = event.block.timestamp;
  token0.createdAtBlockNumber = event.block.number;
  token0.save();

  const token1 = getOrCreateToken(token1Address);
  token1.createdAtTimestamp = event.block.timestamp;
  token1.createdAtBlockNumber = event.block.number;
  token1.save();

  // Create pool
  const pool = new Pool(poolId);
  pool.token0 = token0.id;
  pool.token1 = token1.id;
  pool.feeTier = event.params.fee;
  pool.tickSpacing = event.params.tickSpacing;
  pool.hooks = event.params.hooks;

  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.tick = event.params.tick;
  pool.liquidity = ZERO_BI;

  pool.volumeToken0 = ZERO_BD;
  pool.volumeToken1 = ZERO_BD;
  pool.volumeUSD = ZERO_BD;

  pool.totalValueLockedToken0 = ZERO_BD;
  pool.totalValueLockedToken1 = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;

  pool.feesUSD = ZERO_BD;
  pool.txCount = ZERO_BI;

  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;

  pool.save();

  // Update protocol
  const protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount + 1;
  protocol.save();
}

/**
 * Handle Swap event
 */
export function handleSwap(event: SwapEvent): void {
  const poolId = event.params.id.toHexString();
  const pool = Pool.load(poolId);

  if (pool === null) {
    return;
  }

  // Load tokens
  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 === null || token1 === null) {
    return;
  }

  // Create transaction
  const transaction = getOrCreateTransaction(event);

  // Create swap entity
  const swap = new Swap(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  );
  swap.transaction = transaction.id;
  swap.pool = pool.id;
  swap.sender = event.params.sender;

  // Convert amounts
  swap.amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  swap.amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  // TODO: Calculate USD value using price oracle
  swap.amountUSD = ZERO_BD;

  swap.sqrtPriceX96 = event.params.sqrtPriceX96After;
  swap.tick = event.params.tickAfter;
  swap.logIndex = event.logIndex;
  swap.timestamp = event.block.timestamp;

  swap.save();

  // Update pool state
  pool.sqrtPrice = event.params.sqrtPriceX96After;
  pool.tick = event.params.tickAfter;
  pool.liquidity = event.params.liquidity;
  pool.txCount = pool.txCount.plus(ONE_BI);

  // Update volumes (use absolute values)
  const absAmount0 = swap.amount0.lt(ZERO_BD) ? swap.amount0.neg() : swap.amount0;
  const absAmount1 = swap.amount1.lt(ZERO_BD) ? swap.amount1.neg() : swap.amount1;

  pool.volumeToken0 = pool.volumeToken0.plus(absAmount0);
  pool.volumeToken1 = pool.volumeToken1.plus(absAmount1);
  pool.volumeUSD = pool.volumeUSD.plus(swap.amountUSD);

  pool.save();

  // Update protocol
  const protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  protocol.totalVolumeUSD = protocol.totalVolumeUSD.plus(swap.amountUSD);
  protocol.updatedAt = event.block.timestamp;
  protocol.save();

  // TODO: Update time-series data (PoolHourData, PoolDayData)
}

/**
 * Handle ModifyLiquidity event (mint/burn)
 */
export function handleModifyLiquidity(event: ModifyLiquidity): void {
  const poolId = event.params.id.toHexString();
  const pool = Pool.load(poolId);

  if (pool === null) {
    return;
  }

  // Load tokens
  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 === null || token1 === null) {
    return;
  }

  // Create transaction
  const transaction = getOrCreateTransaction(event);

  // Determine if mint or burn based on liquidity delta
  const liquidityDelta = event.params.liquidityDelta;

  if (liquidityDelta.gt(ZERO_BI)) {
    // Mint (add liquidity)
    const mint = new Mint(
      event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    );
    mint.transaction = transaction.id;
    mint.pool = pool.id;
    mint.owner = event.params.sender;
    mint.sender = event.params.sender;
    mint.tickLower = event.params.tickLower;
    mint.tickUpper = event.params.tickUpper;
    mint.liquidity = liquidityDelta;

    // TODO: Calculate token amounts from liquidity delta
    mint.amount0 = ZERO_BD;
    mint.amount1 = ZERO_BD;
    mint.amountUSD = ZERO_BD;

    mint.logIndex = event.logIndex;
    mint.timestamp = event.block.timestamp;

    mint.save();
  } else if (liquidityDelta.lt(ZERO_BI)) {
    // Burn (remove liquidity)
    const burn = new Burn(
      event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    );
    burn.transaction = transaction.id;
    burn.pool = pool.id;
    burn.owner = event.params.sender;
    burn.tickLower = event.params.tickLower;
    burn.tickUpper = event.params.tickUpper;
    burn.liquidity = liquidityDelta.neg();

    // TODO: Calculate token amounts from liquidity delta
    burn.amount0 = ZERO_BD;
    burn.amount1 = ZERO_BD;
    burn.amountUSD = ZERO_BD;

    burn.logIndex = event.logIndex;
    burn.timestamp = event.block.timestamp;

    burn.save();
  }

  // Update pool
  pool.txCount = pool.txCount.plus(ONE_BI);
  pool.save();
}

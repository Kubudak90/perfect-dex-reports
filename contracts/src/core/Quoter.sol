// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {SwapMath} from "../libraries/SwapMath.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {SafeCast} from "../libraries/SafeCast.sol";

/// @title Quoter
/// @author BaseBook Team
/// @notice Provides quotes for swaps without executing them
/// @dev Uses static calls to simulate swaps and return quotes.
///      Gas estimates combine measured gasleft() with base constants and a safety buffer
///      to resist caller manipulation and account for real execution overhead
///      (token transfers, state writes, event emissions, hook callbacks).
contract Quoter {
    // ══════════════════════════════════════════════════════════════════════
    // GAS ESTIMATION CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Base gas cost for a single-hop swap execution
    /// @dev Covers PoolManager.swap call overhead, token transfers (2x ERC-20
    ///      safeTransfer / safeTransferFrom), balance delta accounting, state
    ///      slot updates (SSTORE), and event emissions.
    uint256 public constant BASE_SWAP_GAS = 100_000;

    /// @notice Additional gas cost per extra hop in a multi-hop swap path
    /// @dev Each extra hop incurs another PoolManager.swap, an intermediate
    ///      token transfer, additional state reads/writes, and path decoding.
    uint256 public constant PER_HOP_GAS = 80_000;

    /// @notice Additional gas cost when a pool has a hooks contract attached
    /// @dev Accounts for the external calls to beforeSwap and afterSwap hook
    ///      callbacks including cross-contract call overhead and hook logic.
    uint256 public constant HOOK_GAS = 50_000;

    /// @notice Gas buffer numerator (120 = 1.20x multiplier, i.e. 20% safety margin)
    /// @dev Applied to the measured gasleft() delta to account for variability
    ///      between simulation and actual execution environments.
    uint256 public constant GAS_BUFFER_NUMERATOR = 120;

    /// @notice Gas buffer denominator (100 for percentage-based calculation)
    uint256 public constant GAS_BUFFER_DENOMINATOR = 100;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    /// @notice The PoolManager contract
    IPoolManager public immutable poolManager;

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Parameters for quote calculation
    struct QuoteParams {
        PoolKey poolKey;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Quote result
    struct QuoteResult {
        uint256 amountIn;
        uint256 amountOut;
        uint160 sqrtPriceX96After;
        int24 tickAfter;
        uint256 gasEstimate;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error InvalidAmount();

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
    }

    // ══════════════════════════════════════════════════════════════════════
    // QUOTE FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the amount out received for a given exact input swap without executing the swap
    /// @param params The quote parameters
    /// @return result The quote result
    function quoteExactInputSingle(QuoteParams memory params) external returns (QuoteResult memory result) {
        if (params.amountSpecified <= 0) revert InvalidAmount();

        uint256 gasBefore = gasleft();
        result = _simulateSwap(params);
        uint256 measuredGas = gasBefore - gasleft();

        result.gasEstimate = _computeGasEstimate(measuredGas, 1, params.poolKey);
    }

    /// @notice Returns the amount in required for a given exact output swap without executing the swap
    /// @param params The quote parameters (with negative amountSpecified)
    /// @return result The quote result
    function quoteExactOutputSingle(QuoteParams memory params) external returns (QuoteResult memory result) {
        if (params.amountSpecified >= 0) revert InvalidAmount();

        uint256 gasBefore = gasleft();
        result = _simulateSwap(params);
        uint256 measuredGas = gasBefore - gasleft();

        result.gasEstimate = _computeGasEstimate(measuredGas, 1, params.poolKey);
    }

    /// @dev Internal helper to simulate a swap step, reducing stack depth in quote functions
    function _simulateSwap(QuoteParams memory params) internal view returns (QuoteResult memory result) {
        bytes32 poolId = keccak256(abi.encode(params.poolKey));
        (uint160 sqrtPriceX96, , , uint24 lpFee) = poolManager.getSlot0(poolId);

        if (sqrtPriceX96 == 0) revert PoolNotInitialized();

        uint128 liquidity = poolManager.getLiquidity(poolId);

        uint160 sqrtPriceLimitX96 = params.sqrtPriceLimitX96 == 0
            ? (params.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1)
            : params.sqrtPriceLimitX96;

        (uint160 sqrtPriceNextX96, uint256 amountIn, uint256 amountOut, uint256 feeAmount) =
            SwapMath.computeSwapStep(sqrtPriceX96, sqrtPriceLimitX96, liquidity, params.amountSpecified, lpFee);

        result = QuoteResult({
            amountIn: amountIn + feeAmount,
            amountOut: amountOut,
            sqrtPriceX96After: sqrtPriceNextX96,
            tickAfter: TickMath.getTickAtSqrtPrice(sqrtPriceNextX96),
            gasEstimate: 0
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // GAS ESTIMATION INTERNALS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Computes a robust gas estimate that resists gasleft() manipulation
    /// @dev Returns max(measuredGas * 1.2, baseEstimate) where baseEstimate is derived
    ///      from constants that model real swap execution costs (transfers, state writes,
    ///      hooks, per-hop overhead). This ensures that even if a caller supplies minimal
    ///      gas to deflate the measured value, the estimate remains a safe lower bound.
    /// @param measuredGas The raw gasleft() delta from the simulation
    /// @param numHops Number of hops in the swap path (1 for single-hop)
    /// @param poolKey The pool key (used to detect hooks)
    /// @return gasEstimate The final robust gas estimate
    function _computeGasEstimate(uint256 measuredGas, uint256 numHops, PoolKey memory poolKey)
        internal
        pure
        returns (uint256 gasEstimate)
    {
        // Apply 20% safety buffer to the measured gas
        uint256 bufferedMeasuredGas = (measuredGas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;

        // Build base estimate from constants
        // Base cost: covers PoolManager.swap overhead, 2x token transfers, state updates, events
        uint256 baseEstimate = BASE_SWAP_GAS;

        // Add per-hop overhead for each additional hop beyond the first
        if (numHops > 1) {
            baseEstimate += PER_HOP_GAS * (numHops - 1);
        }

        // Add hook callback overhead if the pool has hooks attached
        if (_hasHooks(poolKey)) {
            // Each hop with hooks incurs beforeSwap + afterSwap callbacks
            baseEstimate += HOOK_GAS * numHops;
        }

        // Return the larger of the two estimates to ensure safety
        gasEstimate = bufferedMeasuredGas > baseEstimate ? bufferedMeasuredGas : baseEstimate;
    }

    /// @notice Checks whether a pool has a hooks contract attached
    /// @param poolKey The pool key to inspect
    /// @return True if the pool has a non-zero hooks address
    function _hasHooks(PoolKey memory poolKey) internal pure returns (bool) {
        return address(poolKey.hooks) != address(0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // POOL QUERY FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get a price quote for a specific pool
    /// @param poolKey The pool to quote
    /// @return sqrtPriceX96 The current sqrt price
    /// @return tick The current tick
    /// @return liquidity The current liquidity
    function getPoolPrice(PoolKey memory poolKey)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint128 liquidity)
    {
        bytes32 poolId = keccak256(abi.encode(poolKey));
        (sqrtPriceX96, tick,,) = poolManager.getSlot0(poolId);
        liquidity = poolManager.getLiquidity(poolId);
    }

    /// @notice Calculate the price ratio between two tokens
    /// @param poolKey The pool to calculate price for
    /// @return price The price of token1 in terms of token0 (with 18 decimals)
    function getPrice(PoolKey memory poolKey) external view returns (uint256 price) {
        bytes32 poolId = keccak256(abi.encode(poolKey));
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        if (sqrtPriceX96 == 0) revert PoolNotInitialized();

        // price = (sqrtPriceX96 / 2^96)^2
        // Simplified calculation for quote purposes
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        price = (priceX192 * 1e18) >> 192;
    }
}

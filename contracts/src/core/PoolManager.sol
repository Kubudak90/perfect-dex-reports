// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {PoolKey, PoolIdLibrary} from "../types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {SwapMath} from "../libraries/SwapMath.sol";
import {LiquidityMath} from "../libraries/LiquidityMath.sol";
import {SafeCast} from "../libraries/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PoolManager
/// @author BaseBook Team
/// @notice Manages all liquidity pools in the protocol (Singleton pattern)
/// @dev Implements Ekubo EVM-inspired architecture adapted for Base chain
contract PoolManager is IPoolManager, ReentrancyGuard, Pausable, Ownable {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice The minimum tick that can be used in any pool
    int24 public constant MIN_TICK = -887272;

    /// @notice The maximum tick that can be used in any pool
    int24 public constant MAX_TICK = 887272;

    /// @notice The minimum sqrt price (at MIN_TICK)
    uint160 public constant MIN_SQRT_PRICE = 4295128739;

    /// @notice The maximum sqrt price (at MAX_TICK)
    uint160 public constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;

    /// @notice Maximum number of initialized ticks allowed per pool to prevent DoS via unbounded array growth
    /// @dev Generous limit that accommodates legitimate use while preventing O(n) iteration attacks
    uint256 public constant MAX_TICKS_PER_POOL = 10000;

    /// @notice Minimum liquidity required to initialize a new tick, making tick-spam attacks more expensive
    /// @dev Set to 1000 units to prevent dust-level liquidity from consuming tick slots
    uint128 public constant MIN_LIQUIDITY_PER_TICK = 1000;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Stores the state for each pool
    mapping(bytes32 poolId => Slot0) public pools;

    /// @notice Stores the liquidity for each pool
    mapping(bytes32 poolId => uint128) public liquidity;

    /// @notice Tick info for tracking liquidity at each initialized tick
    struct TickInfo {
        uint128 liquidityGross; // Total liquidity referencing this tick
        int128 liquidityNet; // Net liquidity change when tick is crossed
        bool initialized;
    }

    /// @notice Tick data per pool
    mapping(bytes32 poolId => mapping(int24 tick => TickInfo)) public ticks;

    /// @notice Tracks all initialized tick indices per pool for traversal
    /// @dev Maps poolId => sorted array of initialized tick indices
    mapping(bytes32 poolId => int24[]) internal _initializedTicks;

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolAlreadyInitialized();
    error PoolNotInitialized();
    error TicksMisordered();
    error TickLowerOutOfBounds();
    error TickUpperOutOfBounds();
    error CurrenciesOutOfOrderOrEqual();
    error InvalidSqrtPrice();
    error InvalidHookResponse();
    error MaxTicksExceeded();
    error MinimumLiquidityNotMet();

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Initializes the PoolManager with the deployer as owner
    constructor() Ownable(msg.sender) {}

    // ══════════════════════════════════════════════════════════════════════
    // PAUSE / UNPAUSE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pauses swap and modifyLiquidity operations
    /// @dev Only callable by the contract owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses swap and modifyLiquidity operations
    /// @dev Only callable by the contract owner
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency pause that can be called by owner without timelock delay
    /// @dev Functionally identical to pause() but semantically signals emergency use
    function emergencyPause() external onlyOwner {
        _pause();
    }

    // ══════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @inheritdoc IPoolManager
    /// @dev Uses calldata for gas optimization on read-only parameter
    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        // Validate currencies are sorted
        if (key.currency0 >= key.currency1) revert CurrenciesOutOfOrderOrEqual();

        // Validate sqrt price
        if (sqrtPriceX96 < MIN_SQRT_PRICE || sqrtPriceX96 >= MAX_SQRT_PRICE) {
            revert InvalidSqrtPrice();
        }

        bytes32 poolId = key.toId();

        // Check if pool already initialized
        if (pools[poolId].sqrtPriceX96 != 0) revert PoolAlreadyInitialized();

        // Call beforeInitialize hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            bytes4 selector = key.hooks.beforeInitialize(msg.sender, key, sqrtPriceX96);
            if (selector != IHooks.beforeInitialize.selector) revert InvalidHookResponse();
        }

        // Calculate initial tick from sqrtPriceX96
        tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        // Initialize pool state
        pools[poolId] = Slot0({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            protocolFee: 0,
            lpFee: key.fee
        });

        // Call afterInitialize hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            bytes4 selector = key.hooks.afterInitialize(msg.sender, key, sqrtPriceX96, tick);
            if (selector != IHooks.afterInitialize.selector) revert InvalidHookResponse();
        }

        emit Initialize(
            poolId,
            key.currency0,
            key.currency1,
            key.fee,
            key.tickSpacing,
            address(key.hooks),
            sqrtPriceX96,
            tick
        );

        return tick;
    }

    /// @inheritdoc IPoolManager
    /// @dev Uses calldata for gas optimization on read-only parameters
    function modifyLiquidity(PoolKey calldata key, ModifyLiquidityParams calldata params)
        external
        nonReentrant
        whenNotPaused
        returns (int256 delta)
    {
        bytes32 poolId = key.toId();
        Slot0 memory slot0Cache = pools[poolId];

        // Check if pool is initialized
        if (slot0Cache.sqrtPriceX96 == 0) revert PoolNotInitialized();

        // Validate tick bounds
        if (params.tickLower < MIN_TICK) revert TickLowerOutOfBounds();
        if (params.tickUpper > MAX_TICK) revert TickUpperOutOfBounds();
        if (params.tickLower >= params.tickUpper) revert TicksMisordered();

        // Call beforeModifyLiquidity hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            bytes4 selector = key.hooks.beforeModifyLiquidity(msg.sender, key, params);
            if (selector != IHooks.beforeModifyLiquidity.selector) revert InvalidHookResponse();
        }

        // Update per-tick liquidity tracking
        _updateTick(poolId, params.tickLower, params.tickUpper, params.liquidityDelta);

        // Update global liquidity only if the current tick is within the position's range
        // This ensures global liquidity reflects the actual in-range liquidity
        if (slot0Cache.tick >= params.tickLower && slot0Cache.tick < params.tickUpper) {
            uint128 liquidityBefore = liquidity[poolId];
            if (params.liquidityDelta >= 0) {
                unchecked {
                    liquidity[poolId] = liquidityBefore + uint128(uint256(params.liquidityDelta));
                }
            } else {
                uint128 liquidityToRemove = uint128(uint256(-params.liquidityDelta));
                if (liquidityToRemove > liquidityBefore) revert InsufficientLiquidity();
                unchecked {
                    liquidity[poolId] = liquidityBefore - liquidityToRemove;
                }
            }
        }

        // Calculate delta (simplified)
        // In production, this would be based on actual token amounts needed
        delta = params.liquidityDelta;

        // Call afterModifyLiquidity hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            // Create balance delta (simplified - in production would be actual token amounts)
            BalanceDelta balanceDelta = BalanceDelta.wrap(int256(delta));
            bytes4 selector = key.hooks.afterModifyLiquidity(msg.sender, key, params, balanceDelta);
            if (selector != IHooks.afterModifyLiquidity.selector) revert InvalidHookResponse();
        }

        emit ModifyLiquidity(poolId, msg.sender, params.tickLower, params.tickUpper, params.liquidityDelta);

        return delta;
    }

    error InsufficientLiquidity();

    /// @inheritdoc IPoolManager
    /// @dev Uses calldata for gas optimization on read-only parameters
    function swap(PoolKey calldata key, SwapParams calldata params)
        external
        nonReentrant
        whenNotPaused
        returns (int256 amount0, int256 amount1)
    {
        bytes32 poolId = key.toId();
        Slot0 memory slot0Cache = pools[poolId];

        // Check if pool is initialized
        if (slot0Cache.sqrtPriceX96 == 0) revert PoolNotInitialized();

        // Call beforeSwap hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            bytes4 selector = key.hooks.beforeSwap(msg.sender, key, params);
            if (selector != IHooks.beforeSwap.selector) revert InvalidHookResponse();
        }

        // Full multi-tick crossing swap implementation
        SwapState memory state = SwapState({
            amountSpecifiedRemaining: params.amountSpecified,
            amountCalculated: 0,
            sqrtPriceX96: slot0Cache.sqrtPriceX96,
            tick: slot0Cache.tick,
            liquidity: liquidity[poolId]
        });

        // Execute the swap loop
        _executeSwapLoop(poolId, state, params, slot0Cache.lpFee);

        // Update pool state and calculate final amounts
        (amount0, amount1) = _finalizeSwap(poolId, key, params, state, slot0Cache);
    }

    /// @dev Executes the multi-tick swap loop
    function _executeSwapLoop(
        bytes32 poolId,
        SwapState memory state,
        SwapParams calldata params,
        uint24 lpFee
    ) internal {
        while (state.amountSpecifiedRemaining != 0 && state.sqrtPriceX96 != params.sqrtPriceLimitX96) {
            _executeSwapStep(poolId, state, params, lpFee);
        }
    }

    /// @dev Executes a single step of the swap loop
    function _executeSwapStep(
        bytes32 poolId,
        SwapState memory state,
        SwapParams calldata params,
        uint24 lpFee
    ) internal {
        // Find the next initialized tick in the swap direction
        int24 tickNext = _findNextInitializedTick(poolId, state.tick, params.zeroForOne);

        // Clamp tickNext to valid bounds
        if (tickNext < MIN_TICK) tickNext = MIN_TICK;
        if (tickNext > MAX_TICK) tickNext = MAX_TICK;

        // Get sqrt price at the next tick boundary
        uint160 sqrtPriceNextTickX96 = TickMath.getSqrtPriceAtTick(tickNext);

        // Determine the target price for this step (clamped by sqrtPriceLimitX96)
        uint160 sqrtPriceTargetX96 = _getSwapTargetPrice(sqrtPriceNextTickX96, params.sqrtPriceLimitX96, params.zeroForOne);

        // Compute swap step within this tick range
        (uint160 sqrtPriceNextX96, uint256 amountIn, uint256 amountOut, uint256 feeAmount) = SwapMath
            .computeSwapStep(
            state.sqrtPriceX96, sqrtPriceTargetX96, state.liquidity, state.amountSpecifiedRemaining, lpFee
        );

        // Update amounts
        if (params.amountSpecified >= 0) {
            state.amountSpecifiedRemaining -= SafeCast.toInt256(amountIn + feeAmount);
            state.amountCalculated -= SafeCast.toInt256(amountOut);
        } else {
            state.amountSpecifiedRemaining += SafeCast.toInt256(amountOut);
            state.amountCalculated += SafeCast.toInt256(amountIn + feeAmount);
        }

        state.sqrtPriceX96 = sqrtPriceNextX96;

        // Handle tick crossing
        if (state.sqrtPriceX96 == sqrtPriceNextTickX96) {
            _crossTick(poolId, tickNext, state, params.zeroForOne);
        } else {
            state.tick = TickMath.getTickAtSqrtPrice(state.sqrtPriceX96);
        }
    }

    /// @dev Returns the target price for a swap step, clamped by the price limit
    function _getSwapTargetPrice(uint160 sqrtPriceNextTickX96, uint160 sqrtPriceLimitX96, bool zeroForOne)
        internal
        pure
        returns (uint160)
    {
        if (zeroForOne) {
            return sqrtPriceNextTickX96 < sqrtPriceLimitX96 ? sqrtPriceLimitX96 : sqrtPriceNextTickX96;
        } else {
            return sqrtPriceNextTickX96 > sqrtPriceLimitX96 ? sqrtPriceLimitX96 : sqrtPriceNextTickX96;
        }
    }

    /// @dev Crosses a tick and updates liquidity and tick in the swap state
    function _crossTick(bytes32 poolId, int24 tickNext, SwapState memory state, bool zeroForOne) internal {
        TickInfo storage tickInfo = ticks[poolId][tickNext];
        if (tickInfo.initialized) {
            int128 liquidityNet = tickInfo.liquidityNet;
            if (zeroForOne) liquidityNet = -liquidityNet;
            state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
        }
        state.tick = zeroForOne ? tickNext - 1 : tickNext;
    }

    /// @dev Finalizes the swap by updating storage and calling afterSwap hook
    function _finalizeSwap(
        bytes32 poolId,
        PoolKey calldata key,
        SwapParams calldata params,
        SwapState memory state,
        Slot0 memory slot0Cache
    ) internal returns (int256 amount0, int256 amount1) {
        // Update pool state (single SSTORE for gas efficiency)
        pools[poolId] = Slot0({
            sqrtPriceX96: state.sqrtPriceX96,
            tick: state.tick,
            protocolFee: slot0Cache.protocolFee,
            lpFee: slot0Cache.lpFee
        });

        // Write back liquidity if it changed due to tick crossings
        liquidity[poolId] = state.liquidity;

        // Calculate final amounts
        (amount0, amount1) = _calculateSwapAmounts(params, state);

        // Call afterSwap hook if hooks != address(0)
        if (address(key.hooks) != address(0)) {
            BalanceDelta balanceDelta = BalanceDelta.wrap(amount0);
            bytes4 selector = key.hooks.afterSwap(msg.sender, key, params, balanceDelta);
            if (selector != IHooks.afterSwap.selector) revert InvalidHookResponse();
        }

        emit Swap(poolId, msg.sender, amount0, amount1, state.sqrtPriceX96, state.liquidity, state.tick, slot0Cache.lpFee);
    }

    /// @dev Calculates the final swap amounts from the swap state
    function _calculateSwapAmounts(SwapParams calldata params, SwapState memory state)
        internal
        pure
        returns (int256 amount0, int256 amount1)
    {
        (amount0, amount1) = params.zeroForOne
            ? (
                params.amountSpecified >= 0
                    ? params.amountSpecified - state.amountSpecifiedRemaining
                    : state.amountCalculated,
                params.amountSpecified >= 0 ? state.amountCalculated : params.amountSpecified - state.amountSpecifiedRemaining
            )
            : (
                params.amountSpecified >= 0 ? state.amountCalculated : params.amountSpecified - state.amountSpecifiedRemaining,
                params.amountSpecified >= 0
                    ? params.amountSpecified - state.amountSpecifiedRemaining
                    : state.amountCalculated
            );
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Struct to hold swap state
    struct SwapState {
        int256 amountSpecifiedRemaining;
        int256 amountCalculated;
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @inheritdoc IPoolManager
    function getSlot0(bytes32 poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee)
    {
        Slot0 memory slot0 = pools[poolId];
        return (slot0.sqrtPriceX96, slot0.tick, slot0.protocolFee, slot0.lpFee);
    }

    /// @inheritdoc IPoolManager
    function getLiquidity(bytes32 poolId) external view returns (uint128) {
        return liquidity[poolId];
    }

    /// @notice Returns the array of initialized ticks for a pool (for testing/debugging)
    function getInitializedTicks(bytes32 poolId) external view returns (int24[] memory) {
        return _initializedTicks[poolId];
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Updates tick-level liquidity data when liquidity is added or removed
    /// @param poolId The pool ID
    /// @param tickLower The lower tick of the position
    /// @param tickUpper The upper tick of the position
    /// @param liquidityDelta The amount of liquidity to add (positive) or remove (negative)
    function _updateTick(bytes32 poolId, int24 tickLower, int24 tickUpper, int256 liquidityDelta) internal {
        if (liquidityDelta == 0) return;

        // Update lower tick
        TickInfo storage lower = ticks[poolId][tickLower];
        uint128 liquidityGrossBefore = lower.liquidityGross;

        if (liquidityDelta > 0) {
            uint128 liquidityDeltaAbs = uint128(uint256(liquidityDelta));
            lower.liquidityGross = liquidityGrossBefore + liquidityDeltaAbs;
            // Lower tick: positive liquidityNet (liquidity enters when crossing upward)
            lower.liquidityNet = lower.liquidityNet + int128(int256(liquidityDelta));
        } else {
            uint128 liquidityDeltaAbs = uint128(uint256(-liquidityDelta));
            if (liquidityDeltaAbs > liquidityGrossBefore) revert InsufficientLiquidity();
            lower.liquidityGross = liquidityGrossBefore - liquidityDeltaAbs;
            lower.liquidityNet = lower.liquidityNet + int128(int256(liquidityDelta));
        }

        // If tick was not initialized and now has liquidity, mark as initialized
        if (liquidityGrossBefore == 0 && lower.liquidityGross > 0) {
            // Enforce minimum liquidity to make tick-spam attacks more expensive
            if (lower.liquidityGross < MIN_LIQUIDITY_PER_TICK) revert MinimumLiquidityNotMet();
            lower.initialized = true;
            _insertInitializedTick(poolId, tickLower);
        }
        // If tick had liquidity but now has none, mark as uninitialized
        if (liquidityGrossBefore > 0 && lower.liquidityGross == 0) {
            lower.initialized = false;
            lower.liquidityNet = 0;
            _removeInitializedTick(poolId, tickLower);
        }

        // Update upper tick
        TickInfo storage upper = ticks[poolId][tickUpper];
        uint128 upperLiquidityGrossBefore = upper.liquidityGross;

        if (liquidityDelta > 0) {
            uint128 liquidityDeltaAbs = uint128(uint256(liquidityDelta));
            upper.liquidityGross = upperLiquidityGrossBefore + liquidityDeltaAbs;
            // Upper tick: negative liquidityNet (liquidity exits when crossing upward)
            upper.liquidityNet = upper.liquidityNet - int128(int256(liquidityDelta));
        } else {
            uint128 liquidityDeltaAbs = uint128(uint256(-liquidityDelta));
            if (liquidityDeltaAbs > upperLiquidityGrossBefore) revert InsufficientLiquidity();
            upper.liquidityGross = upperLiquidityGrossBefore - liquidityDeltaAbs;
            upper.liquidityNet = upper.liquidityNet - int128(int256(liquidityDelta));
        }

        // If tick was not initialized and now has liquidity, mark as initialized
        if (upperLiquidityGrossBefore == 0 && upper.liquidityGross > 0) {
            // Enforce minimum liquidity to make tick-spam attacks more expensive
            if (upper.liquidityGross < MIN_LIQUIDITY_PER_TICK) revert MinimumLiquidityNotMet();
            upper.initialized = true;
            _insertInitializedTick(poolId, tickUpper);
        }
        // If tick had liquidity but now has none, mark as uninitialized
        if (upperLiquidityGrossBefore > 0 && upper.liquidityGross == 0) {
            upper.initialized = false;
            upper.liquidityNet = 0;
            _removeInitializedTick(poolId, tickUpper);
        }
    }

    /// @notice Finds the next initialized tick in the direction of the swap
    /// @param poolId The pool ID
    /// @param tick The current tick
    /// @param zeroForOne Whether the swap is token0 -> token1 (price decreasing, search left)
    /// @return nextTick The next initialized tick, or MIN_TICK/MAX_TICK if none found
    function _findNextInitializedTick(bytes32 poolId, int24 tick, bool zeroForOne)
        internal
        view
        returns (int24 nextTick)
    {
        int24[] storage tickArray = _initializedTicks[poolId];
        uint256 len = tickArray.length;

        if (len == 0) {
            // No initialized ticks - return boundary
            return zeroForOne ? MIN_TICK : MAX_TICK;
        }

        if (zeroForOne) {
            // Search for the highest initialized tick <= tick (moving left/downward)
            // We want the tick boundary we'll hit as price decreases
            nextTick = MIN_TICK;
            for (uint256 i = 0; i < len; i++) {
                int24 t = tickArray[i];
                if (t <= tick && t > nextTick) {
                    nextTick = t;
                }
            }
        } else {
            // Search for the lowest initialized tick > tick (moving right/upward)
            // We want the tick boundary we'll hit as price increases
            nextTick = MAX_TICK;
            for (uint256 i = 0; i < len; i++) {
                int24 t = tickArray[i];
                if (t > tick && t < nextTick) {
                    nextTick = t;
                }
            }
        }
    }

    /// @notice Inserts a tick into the sorted initialized ticks array
    /// @param poolId The pool ID
    /// @param tick The tick to insert
    function _insertInitializedTick(bytes32 poolId, int24 tick) internal {
        int24[] storage tickArray = _initializedTicks[poolId];

        // Check if already present
        uint256 len = tickArray.length;
        for (uint256 i = 0; i < len; i++) {
            if (tickArray[i] == tick) return; // Already exists
        }

        // Enforce maximum tick count per pool to prevent DoS via unbounded array growth
        if (len >= MAX_TICKS_PER_POOL) revert MaxTicksExceeded();

        // Insert: find insertion point to maintain sorted order
        tickArray.push(tick);
        len = tickArray.length;
        // Bubble the new element into its sorted position
        for (uint256 i = len - 1; i > 0; i--) {
            if (tickArray[i] < tickArray[i - 1]) {
                (tickArray[i], tickArray[i - 1]) = (tickArray[i - 1], tickArray[i]);
            } else {
                break;
            }
        }
    }

    /// @notice Removes a tick from the initialized ticks array
    /// @param poolId The pool ID
    /// @param tick The tick to remove
    function _removeInitializedTick(bytes32 poolId, int24 tick) internal {
        int24[] storage tickArray = _initializedTicks[poolId];
        uint256 len = tickArray.length;

        for (uint256 i = 0; i < len; i++) {
            if (tickArray[i] == tick) {
                // Move last element to this position and pop
                tickArray[i] = tickArray[len - 1];
                tickArray.pop();
                // Re-sort if needed (since we moved the last element)
                if (i < tickArray.length) {
                    // Bubble into correct position
                    // Bubble up
                    while (i > 0 && tickArray[i] < tickArray[i - 1]) {
                        (tickArray[i], tickArray[i - 1]) = (tickArray[i - 1], tickArray[i]);
                        i--;
                    }
                    // Bubble down
                    while (i < tickArray.length - 1 && tickArray[i] > tickArray[i + 1]) {
                        (tickArray[i], tickArray[i + 1]) = (tickArray[i + 1], tickArray[i]);
                        i++;
                    }
                }
                return;
            }
        }
    }
}

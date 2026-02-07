// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "../types/PoolKey.sol";
import {Currency} from "../types/Currency.sol";

/// @title IPoolManager
/// @notice Interface for the PoolManager contract
/// @dev The PoolManager is a singleton that manages all pools
interface IPoolManager {
    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Parameters for modifying liquidity
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
    }

    /// @notice Parameters for swapping
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Represents the state of a pool
    struct Slot0 {
        uint160 sqrtPriceX96;
        int24 tick;
        uint16 protocolFee;
        uint24 lpFee;
    }

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a pool is initialized
    event Initialize(
        bytes32 indexed poolId,
        Currency indexed currency0,
        Currency indexed currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        uint160 sqrtPriceX96,
        int24 tick
    );

    /// @notice Emitted when liquidity is modified
    event ModifyLiquidity(
        bytes32 indexed poolId,
        address indexed sender,
        int24 tickLower,
        int24 tickUpper,
        int256 liquidityDelta
    );

    /// @notice Emitted when a swap occurs
    event Swap(
        bytes32 indexed poolId,
        address indexed sender,
        int256 amount0,
        int256 amount1,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick,
        uint24 fee
    );

    // ══════════════════════════════════════════════════════════════════════
    // FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Initialize a new pool
    /// @param key The pool key
    /// @param sqrtPriceX96 The initial sqrt price
    /// @return tick The initial tick
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);

    /// @notice Modify liquidity for a position
    /// @param key The pool key
    /// @param params The modify liquidity parameters
    /// @return delta The balance delta
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params)
        external
        returns (int256 delta);

    /// @notice Execute a swap
    /// @param key The pool key
    /// @param params The swap parameters
    /// @return amount0 The delta of token0
    /// @return amount1 The delta of token1
    function swap(PoolKey memory key, SwapParams memory params) external returns (int256 amount0, int256 amount1);

    /// @notice Get the current state of a pool
    /// @param poolId The pool ID
    /// @return sqrtPriceX96 The current sqrt price
    /// @return tick The current tick
    /// @return protocolFee The protocol fee
    /// @return lpFee The LP fee
    function getSlot0(bytes32 poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee);

    /// @notice Get the liquidity of a pool
    /// @param poolId The pool ID
    /// @return liquidity The current liquidity
    function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity);
}

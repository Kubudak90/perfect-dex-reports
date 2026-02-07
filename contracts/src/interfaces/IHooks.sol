// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "../types/PoolKey.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {IPoolManager} from "./IPoolManager.sol";

/// @notice Interface for pool hooks
/// @dev Hooks allow custom logic to be executed at various points in the pool lifecycle
interface IHooks {
    /// @notice Called before initializing a pool
    /// @param sender The address calling initialize
    /// @param key The pool key
    /// @param sqrtPriceX96 The initial sqrt price
    /// @return bytes4 The function selector if successful
    function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        external
        returns (bytes4);

    /// @notice Called after initializing a pool
    /// @param sender The address calling initialize
    /// @param key The pool key
    /// @param sqrtPriceX96 The initial sqrt price
    /// @param tick The initial tick
    /// @return bytes4 The function selector if successful
    function afterInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick)
        external
        returns (bytes4);

    /// @notice Called before modifying liquidity
    /// @param sender The address modifying liquidity
    /// @param key The pool key
    /// @param params The liquidity modification parameters
    /// @return bytes4 The function selector if successful
    function beforeModifyLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params)
        external
        returns (bytes4);

    /// @notice Called after modifying liquidity
    /// @param sender The address modifying liquidity
    /// @param key The pool key
    /// @param params The liquidity modification parameters
    /// @param delta The balance delta
    /// @return bytes4 The function selector if successful
    function afterModifyLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta delta
    ) external returns (bytes4);

    /// @notice Called before a swap
    /// @param sender The address initiating the swap
    /// @param key The pool key
    /// @param params The swap parameters
    /// @return bytes4 The function selector if successful
    function beforeSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params)
        external
        returns (bytes4);

    /// @notice Called after a swap
    /// @param sender The address initiating the swap
    /// @param key The pool key
    /// @param params The swap parameters
    /// @param delta The balance delta
    /// @return bytes4 The function selector if successful
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta
    ) external returns (bytes4);
}

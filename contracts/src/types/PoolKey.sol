// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Currency} from "./Currency.sol";
import {IHooks} from "../interfaces/IHooks.sol";

/// @notice PoolKey uniquely identifies a pool
/// @dev Struct that contains all the identifying information for a pool
struct PoolKey {
    /// @notice The lower currency of the pool, sorted numerically
    Currency currency0;
    /// @notice The higher currency of the pool, sorted numerically
    Currency currency1;
    /// @notice The fee tier for the pool
    uint24 fee;
    /// @notice The tick spacing for the pool
    int24 tickSpacing;
    /// @notice The hooks contract for the pool
    IHooks hooks;
}

/// @notice Library for computing the ID of a pool
library PoolIdLibrary {
    /// @notice Returns the pool ID for the given pool key
    /// @param key The pool key
    /// @return The pool ID (bytes32 hash of the pool key)
    function toId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }
}

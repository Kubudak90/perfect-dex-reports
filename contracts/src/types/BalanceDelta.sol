// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A balance delta is a change in token balance
/// @dev Represented as int256 where positive means tokens owed to the pool, negative means tokens owed to the user
type BalanceDelta is int256;

using {add as +, sub as -, eq as ==, neq as !=} for BalanceDelta global;

/// @notice Add two balance deltas
function add(BalanceDelta a, BalanceDelta b) pure returns (BalanceDelta) {
    return BalanceDelta.wrap(BalanceDelta.unwrap(a) + BalanceDelta.unwrap(b));
}

/// @notice Subtract two balance deltas
function sub(BalanceDelta a, BalanceDelta b) pure returns (BalanceDelta) {
    return BalanceDelta.wrap(BalanceDelta.unwrap(a) - BalanceDelta.unwrap(b));
}

/// @notice Check if two balance deltas are equal
function eq(BalanceDelta a, BalanceDelta b) pure returns (bool) {
    return BalanceDelta.unwrap(a) == BalanceDelta.unwrap(b);
}

/// @notice Check if two balance deltas are not equal
function neq(BalanceDelta a, BalanceDelta b) pure returns (bool) {
    return BalanceDelta.unwrap(a) != BalanceDelta.unwrap(b);
}

/// @notice Library for BalanceDelta operations
library BalanceDeltaLibrary {
    /// @notice Create a BalanceDelta from an int256
    function toBalanceDelta(int256 delta) internal pure returns (BalanceDelta) {
        return BalanceDelta.wrap(delta);
    }

    /// @notice Convert a BalanceDelta to an int256
    function toInt256(BalanceDelta delta) internal pure returns (int256) {
        return BalanceDelta.unwrap(delta);
    }
}

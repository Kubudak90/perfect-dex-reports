// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SafeCast
/// @notice Contains methods for safely casting between types
library SafeCast {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error SafeCastOverflow();

    // ══════════════════════════════════════════════════════════════════════
    // TO UINT160
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Cast a uint256 to a uint160, revert on overflow
    /// @param x The uint256 to be cast
    /// @return y The passed value, casted to uint160
    function toUint160(uint256 x) internal pure returns (uint160 y) {
        if ((y = uint160(x)) != x) revert SafeCastOverflow();
    }

    // ══════════════════════════════════════════════════════════════════════
    // TO INT128
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Cast a int256 to a int128, revert on overflow or underflow
    /// @param x The int256 to be cast
    /// @return y The passed value, casted to int128
    function toInt128(int256 x) internal pure returns (int128 y) {
        if ((y = int128(x)) != x) revert SafeCastOverflow();
    }

    /// @notice Cast a uint128 to a int128, revert on overflow
    /// @param x The uint128 to be cast
    /// @return The passed value, casted to int128
    function toInt128(uint128 x) internal pure returns (int128) {
        if (x > uint128(type(int128).max)) revert SafeCastOverflow();
        return int128(x);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TO UINT128
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param x The uint256 to be cast
    /// @return y The passed value, casted to uint128
    function toUint128(uint256 x) internal pure returns (uint128 y) {
        if ((y = uint128(x)) != x) revert SafeCastOverflow();
    }

    /// @notice Cast a int128 to a uint128, revert on overflow
    /// @param x The int128 to be cast
    /// @return The passed value, casted to uint128
    function toUint128(int128 x) internal pure returns (uint128) {
        if (x < 0) revert SafeCastOverflow();
        return uint128(x);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TO INT256
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Cast a uint256 to a int256, revert on overflow
    /// @param x The uint256 to be cast
    /// @return y The passed value, casted to int256
    function toInt256(uint256 x) internal pure returns (int256 y) {
        if (x > uint256(type(int256).max)) revert SafeCastOverflow();
        y = int256(x);
    }
}

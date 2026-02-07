// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LiquidityMath
/// @notice Math library for liquidity operations
library LiquidityMath {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error LiquidityUnderflow();
    error LiquidityOverflow();

    // ══════════════════════════════════════════════════════════════════════
    // FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Add a signed liquidity delta to liquidity and revert if it overflows or underflows
    /// @param x The liquidity before change
    /// @param y The delta by which liquidity should be changed
    /// @return z The liquidity delta
    function addDelta(uint128 x, int128 y) internal pure returns (uint128 z) {
        if (y < 0) {
            if ((z = x - uint128(-y)) >= x) revert LiquidityUnderflow();
        } else {
            if ((z = x + uint128(y)) < x) revert LiquidityOverflow();
        }
    }
}

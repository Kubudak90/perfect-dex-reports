// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FullMath} from "./FullMath.sol";

/// @title SqrtPriceMath
/// @notice Contains functions for computing sqrt price changes and token amounts
/// @dev Adapted from Uniswap v3 for BaseBook DEX
library SqrtPriceMath {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PriceOverflow();
    error InvalidSqrtPrice();

    // ══════════════════════════════════════════════════════════════════════
    // FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Gets the next sqrt price given a delta of token0
    /// @dev Always rounds up for exact input cases
    /// @param sqrtPriceX96 The starting price
    /// @param liquidity The amount of usable liquidity
    /// @param amount How much of token0 to add or remove from virtual reserves
    /// @param add Whether to add or remove the amount of token0
    /// @return The price after adding or removing amount
    function getNextSqrtPriceFromAmount0RoundingUp(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) internal pure returns (uint160) {
        if (amount == 0) return sqrtPriceX96;

        uint256 numerator1 = uint256(liquidity) << 96;

        if (add) {
            unchecked {
                uint256 product = amount * sqrtPriceX96;
                if (product / amount == sqrtPriceX96) {
                    uint256 denominator = numerator1 + product;
                    if (denominator >= numerator1) {
                        return uint160(FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator));
                    }
                }
            }
            // Overflow fallback
            return uint160(FullMath.mulDivRoundingUp(numerator1, 1, (numerator1 / sqrtPriceX96) + amount));
        } else {
            unchecked {
                uint256 product = amount * sqrtPriceX96;
                if (product / amount != sqrtPriceX96) revert PriceOverflow();
                if (numerator1 <= product) revert InvalidSqrtPrice();

                uint256 denominator = numerator1 - product;
                return uint160(FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator));
            }
        }
    }

    /// @notice Gets the next sqrt price given a delta of token1
    /// @dev Always rounds down for exact output cases
    /// @param sqrtPriceX96 The starting price
    /// @param liquidity The amount of usable liquidity
    /// @param amount How much of token1 to add or remove from virtual reserves
    /// @param add Whether to add or remove the amount of token1
    /// @return The price after adding or removing amount
    function getNextSqrtPriceFromAmount1RoundingDown(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) internal pure returns (uint160) {
        if (add) {
            uint256 quotient = (amount <= type(uint160).max)
                ? (amount << 96) / liquidity
                : FullMath.mulDiv(amount, 0x1000000000000000000000000, liquidity);

            return uint160(uint256(sqrtPriceX96) + quotient);
        } else {
            uint256 quotient = (amount <= type(uint160).max)
                ? FullMath.mulDivRoundingUp(amount, 0x1000000000000000000000000, liquidity)
                : FullMath.mulDiv(amount, 0x1000000000000000000000000, liquidity);

            if (sqrtPriceX96 <= quotient) revert InvalidSqrtPrice();
            return uint160(uint256(sqrtPriceX96) - quotient);
        }
    }

    /// @notice Gets the amount0 delta between two prices
    /// @dev Calculates liquidity / sqrt(lower) - liquidity / sqrt(upper)
    /// @param sqrtPriceAX96 A sqrt price
    /// @param sqrtPriceBX96 Another sqrt price
    /// @param liquidity The amount of usable liquidity
    /// @param roundUp Whether to round the amount up or down
    /// @return amount0 Amount of token0 required
    function getAmount0Delta(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint128 liquidity, bool roundUp)
        internal
        pure
        returns (uint256 amount0)
    {
        unchecked {
            if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);

            uint256 numerator1 = uint256(liquidity) << 96;
            uint256 numerator2 = sqrtPriceBX96 - sqrtPriceAX96;

            if (sqrtPriceAX96 == 0) revert InvalidSqrtPrice();

            return roundUp
                ? FullMath.mulDivRoundingUp(FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtPriceBX96), 1, sqrtPriceAX96)
                : FullMath.mulDiv(numerator1, numerator2, sqrtPriceBX96) / sqrtPriceAX96;
        }
    }

    /// @notice Gets the amount1 delta between two prices
    /// @dev Calculates liquidity * (sqrt(upper) - sqrt(lower))
    /// @param sqrtPriceAX96 A sqrt price
    /// @param sqrtPriceBX96 Another sqrt price
    /// @param liquidity The amount of usable liquidity
    /// @param roundUp Whether to round the amount up, or down
    /// @return amount1 Amount of token1 required
    function getAmount1Delta(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint128 liquidity, bool roundUp)
        internal
        pure
        returns (uint256 amount1)
    {
        unchecked {
            if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);

            return roundUp
                ? FullMath.mulDivRoundingUp(liquidity, sqrtPriceBX96 - sqrtPriceAX96, 0x1000000000000000000000000)
                : FullMath.mulDiv(liquidity, sqrtPriceBX96 - sqrtPriceAX96, 0x1000000000000000000000000);
        }
    }
}

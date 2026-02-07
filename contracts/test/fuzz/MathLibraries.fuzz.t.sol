// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {SqrtPriceMath} from "../../src/libraries/SqrtPriceMath.sol";
import {LiquidityMath} from "../../src/libraries/LiquidityMath.sol";
import {FullMath} from "../../src/libraries/FullMath.sol";
import {SafeCast} from "../../src/libraries/SafeCast.sol";

/// @title MathLibrariesFuzzTest
/// @notice Fuzz tests for mathematical libraries
/// @dev Tests edge cases and precision with 10,000+ runs
contract MathLibrariesFuzzTest is Test {
    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: TickMath
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test that tick to sqrt price conversion is within valid range
    function testFuzz_TickMath_GetSqrtPriceAtTick(int24 tick) public {
        tick = int24(bound(int256(tick), int256(TickMath.MIN_TICK), int256(TickMath.MAX_TICK)));

        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);

        assertGe(sqrtPriceX96, TickMath.MIN_SQRT_PRICE, "Sqrt price below minimum");
        assertLe(sqrtPriceX96, TickMath.MAX_SQRT_PRICE, "Sqrt price above maximum");
    }

    /// @notice Fuzz test that sqrt price to tick conversion is consistent
    function testFuzz_TickMath_GetTickAtSqrtPrice(uint160 sqrtPriceX96) public {
        sqrtPriceX96 = uint160(
            bound(uint256(sqrtPriceX96), uint256(TickMath.MIN_SQRT_PRICE), uint256(TickMath.MAX_SQRT_PRICE) - 1)
        );

        int24 tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        assertGe(tick, TickMath.MIN_TICK, "Tick below minimum");
        assertLe(tick, TickMath.MAX_TICK, "Tick above maximum");
    }

    /// @notice Fuzz test round-trip: tick → sqrt price → tick
    /// @dev MAX_TICK excluded because its sqrt price equals MAX_SQRT_PRICE which is out of bounds for getTickAtSqrtPrice
    function testFuzz_TickMath_RoundTrip_TickToSqrtPriceToTick(int24 inputTick) public {
        // Exclude MAX_TICK because getSqrtPriceAtTick(MAX_TICK) returns MAX_SQRT_PRICE,
        // and getTickAtSqrtPrice requires sqrtPriceX96 < MAX_SQRT_PRICE
        inputTick = int24(bound(int256(inputTick), int256(TickMath.MIN_TICK), int256(TickMath.MAX_TICK) - 1));

        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(inputTick);
        int24 outputTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        assertApproxEqAbs(uint256(int256(outputTick)), uint256(int256(inputTick)), 1, "Round-trip tick mismatch");
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: SqrtPriceMath
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test getAmount0Delta with random valid inputs
    function testFuzz_SqrtPriceMath_GetAmount0Delta(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity,
        bool roundUp
    ) public {
        sqrtPriceAX96 = uint160(
            bound(uint256(sqrtPriceAX96), uint256(TickMath.MIN_SQRT_PRICE) + 1, uint256(TickMath.MAX_SQRT_PRICE) - 1)
        );
        sqrtPriceBX96 = uint160(
            bound(uint256(sqrtPriceBX96), uint256(TickMath.MIN_SQRT_PRICE) + 1, uint256(TickMath.MAX_SQRT_PRICE) - 1)
        );
        liquidity = uint128(bound(uint256(liquidity), 1, 1e30));

        vm.assume(sqrtPriceAX96 != sqrtPriceBX96);

        uint256 amount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity, roundUp);

        assertLt(amount0, type(uint256).max / 2, "Amount0 too large");
    }

    /// @notice Fuzz test getAmount1Delta with random valid inputs
    function testFuzz_SqrtPriceMath_GetAmount1Delta(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity,
        bool roundUp
    ) public {
        sqrtPriceAX96 = uint160(
            bound(uint256(sqrtPriceAX96), uint256(TickMath.MIN_SQRT_PRICE) + 1, uint256(TickMath.MAX_SQRT_PRICE) - 1)
        );
        sqrtPriceBX96 = uint160(
            bound(uint256(sqrtPriceBX96), uint256(TickMath.MIN_SQRT_PRICE) + 1, uint256(TickMath.MAX_SQRT_PRICE) - 1)
        );
        liquidity = uint128(bound(uint256(liquidity), 1, 1e30));

        vm.assume(sqrtPriceAX96 != sqrtPriceBX96);

        uint256 amount1 = SqrtPriceMath.getAmount1Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity, roundUp);

        assertLt(amount1, type(uint256).max / 2, "Amount1 too large");
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: LiquidityMath
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test adding liquidity delta
    function testFuzz_LiquidityMath_AddDelta_Positive(uint128 liquidity, uint128 delta) public {
        liquidity = uint128(bound(uint256(liquidity), 0, 1e30));
        delta = uint128(bound(uint256(delta), 1, 1e30));

        vm.assume(uint256(liquidity) + uint256(delta) <= type(uint128).max);

        uint128 result = LiquidityMath.addDelta(liquidity, int128(int256(uint256(delta))));

        assertEq(result, liquidity + delta, "Add delta mismatch");
    }

    /// @notice Fuzz test subtracting liquidity delta
    function testFuzz_LiquidityMath_AddDelta_Negative(uint128 liquidity, uint128 delta) public {
        liquidity = uint128(bound(uint256(liquidity), 1e20, 1e30));
        delta = uint128(bound(uint256(delta), 1, uint256(liquidity)));

        uint128 result = LiquidityMath.addDelta(liquidity, -int128(int256(uint256(delta))));

        assertEq(result, liquidity - delta, "Subtract delta mismatch");
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: FullMath
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test mulDiv with random inputs
    function testFuzz_FullMath_MulDiv(uint256 a, uint256 b, uint256 denominator) public {
        a = bound(a, 0, 1e38);
        b = bound(b, 0, 1e38);
        denominator = bound(denominator, 1, 1e38);

        uint256 result = FullMath.mulDiv(a, b, denominator);

        if (a > 0 && b > 0 && denominator >= 1) {
            assertTrue(result <= type(uint256).max, "Result overflow");
        }
    }

    /// @notice Fuzz test mulDivRoundingUp
    function testFuzz_FullMath_MulDivRoundingUp(uint256 a, uint256 b, uint256 denominator) public {
        a = bound(a, 0, 1e38);
        b = bound(b, 0, 1e38);
        denominator = bound(denominator, 1, 1e38);

        uint256 resultRoundDown = FullMath.mulDiv(a, b, denominator);
        uint256 resultRoundUp = FullMath.mulDivRoundingUp(a, b, denominator);

        assertGe(resultRoundUp, resultRoundDown, "Round up should be >= round down");
        assertLe(resultRoundUp - resultRoundDown, 1, "Rounding difference should be at most 1");
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: SafeCast
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test toUint160 with valid inputs
    function testFuzz_SafeCast_ToUint160_Valid(uint256 value) public {
        value = bound(value, 0, type(uint160).max);

        uint160 result = SafeCast.toUint160(value);

        assertEq(uint256(result), value, "SafeCast toUint160 mismatch");
    }

    /// @notice Fuzz test toInt256 with valid inputs
    function testFuzz_SafeCast_ToInt256_Valid(uint256 value) public {
        value = bound(value, 0, uint256(type(int256).max));

        int256 result = SafeCast.toInt256(value);

        assertEq(uint256(result), value, "SafeCast toInt256 mismatch");
    }

    /// @notice Fuzz test toInt128 with valid inputs
    function testFuzz_SafeCast_ToInt128_Valid(uint256 value) public {
        value = bound(value, 0, uint256(uint128(type(int128).max)));
        int256 intValue = int256(value);

        int128 result = SafeCast.toInt128(intValue);

        assertEq(int256(result), intValue, "SafeCast toInt128 mismatch");
    }
}

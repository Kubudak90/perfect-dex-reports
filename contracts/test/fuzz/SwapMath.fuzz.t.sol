// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SwapMath} from "../../src/libraries/SwapMath.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {SqrtPriceMath} from "../../src/libraries/SqrtPriceMath.sol";

/// @title SwapMathFuzzTest
/// @notice Fuzz tests for SwapMath library
/// @dev Critical for swap calculations with 10,000+ runs
contract SwapMathFuzzTest is Test {
    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: computeSwapStep
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test computeSwapStep basic output validation
    function testFuzz_ComputeSwapStep_OutputValidation(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceTargetX96,
        uint128 liquidity,
        uint256 amountRemainingRaw,
        uint24 feePips
    ) public {
        // Very tight bounds to avoid edge cases
        sqrtPriceCurrentX96 = uint160(
            bound(
                uint256(sqrtPriceCurrentX96),
                uint256(TickMath.MIN_SQRT_PRICE) * 10,
                uint256(TickMath.MAX_SQRT_PRICE) / 10
            )
        );
        sqrtPriceTargetX96 = uint160(
            bound(
                uint256(sqrtPriceTargetX96),
                uint256(TickMath.MIN_SQRT_PRICE) * 10,
                uint256(TickMath.MAX_SQRT_PRICE) / 10
            )
        );
        liquidity = uint128(bound(uint256(liquidity), 1e18, 1e26));
        amountRemainingRaw = bound(amountRemainingRaw, 1e15, 1e17);
        feePips = uint24(bound(uint256(feePips), 500, 5000)); // 0.05% to 0.5%

        int256 amountRemaining = int256(amountRemainingRaw);

        vm.assume(sqrtPriceCurrentX96 != sqrtPriceTargetX96);

        (uint160 sqrtPriceNextX96, , , ) =
            SwapMath.computeSwapStep(sqrtPriceCurrentX96, sqrtPriceTargetX96, liquidity, amountRemaining, feePips);

        // Verify output sqrt price is valid
        assertGt(sqrtPriceNextX96, 0, "Next sqrt price should be positive");
        assertLe(sqrtPriceNextX96, TickMath.MAX_SQRT_PRICE, "Next sqrt price exceeds maximum");
        assertGe(sqrtPriceNextX96, TickMath.MIN_SQRT_PRICE, "Next sqrt price below minimum");
    }

    /// @notice Fuzz test that zero liquidity handles gracefully
    function testFuzz_ComputeSwapStep_ZeroLiquidity(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceTargetX96,
        uint256 amountRemainingRaw,
        uint24 feePips
    ) public {
        sqrtPriceCurrentX96 = uint160(
            bound(
                uint256(sqrtPriceCurrentX96),
                uint256(TickMath.MIN_SQRT_PRICE),
                uint256(TickMath.MAX_SQRT_PRICE) - 1
            )
        );
        sqrtPriceTargetX96 = uint160(
            bound(
                uint256(sqrtPriceTargetX96),
                uint256(TickMath.MIN_SQRT_PRICE),
                uint256(TickMath.MAX_SQRT_PRICE) - 1
            )
        );
        amountRemainingRaw = bound(amountRemainingRaw, 1, 1e18);
        feePips = uint24(bound(uint256(feePips), 1, 10000));

        int256 amountRemaining = int256(amountRemainingRaw);

        vm.assume(sqrtPriceCurrentX96 != sqrtPriceTargetX96);

        (uint160 sqrtPriceNextX96, uint256 amountIn, uint256 amountOut, uint256 feeAmount) =
            SwapMath.computeSwapStep(sqrtPriceCurrentX96, sqrtPriceTargetX96, 0, amountRemaining, feePips);

        // With zero liquidity, should reach target price immediately
        assertEq(sqrtPriceNextX96, sqrtPriceTargetX96, "Should reach target with zero liquidity");
        assertEq(amountIn, 0, "No amount in with zero liquidity");
        assertEq(amountOut, 0, "No amount out with zero liquidity");
        assertEq(feeAmount, 0, "No fee with zero liquidity");
    }

    /// @notice Fuzz test price movement direction
    function testFuzz_ComputeSwapStep_PriceMovementDirection(
        uint160 sqrtPriceCurrentX96,
        uint128 liquidity,
        uint256 amountRemainingRaw,
        bool zeroForOne
    ) public {
        sqrtPriceCurrentX96 = uint160(
            bound(
                uint256(sqrtPriceCurrentX96),
                uint256(TickMath.MIN_SQRT_PRICE) + 100000,
                uint256(TickMath.MAX_SQRT_PRICE) - 100000
            )
        );
        liquidity = uint128(bound(uint256(liquidity), 1e18, 1e26));
        amountRemainingRaw = bound(amountRemainingRaw, 1e15, 1e17);

        int256 amountRemaining = int256(amountRemainingRaw);

        uint160 sqrtPriceTargetX96 = zeroForOne
            ? uint160(uint256(sqrtPriceCurrentX96) - 10000)
            : uint160(uint256(sqrtPriceCurrentX96) + 10000);

        (uint160 sqrtPriceNextX96,,,) =
            SwapMath.computeSwapStep(sqrtPriceCurrentX96, sqrtPriceTargetX96, liquidity, amountRemaining, 3000);

        if (zeroForOne) {
            assertLe(sqrtPriceNextX96, sqrtPriceCurrentX96, "Price should decrease for zeroForOne");
        } else {
            assertGe(sqrtPriceNextX96, sqrtPriceCurrentX96, "Price should increase for oneForZero");
        }
    }

    /// @notice Fuzz test that price doesn't overshoot target
    function testFuzz_ComputeSwapStep_DoesNotOvershootTarget(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceTargetX96,
        uint128 liquidity,
        uint256 amountRemainingRaw,
        uint24 feePips
    ) public {
        sqrtPriceCurrentX96 = uint160(
            bound(
                uint256(sqrtPriceCurrentX96),
                uint256(TickMath.MIN_SQRT_PRICE) + 100000,
                uint256(TickMath.MAX_SQRT_PRICE) - 100000
            )
        );
        sqrtPriceTargetX96 = uint160(
            bound(
                uint256(sqrtPriceTargetX96),
                uint256(TickMath.MIN_SQRT_PRICE) + 100000,
                uint256(TickMath.MAX_SQRT_PRICE) - 100000
            )
        );
        liquidity = uint128(bound(uint256(liquidity), 1e18, 1e26));
        amountRemainingRaw = bound(amountRemainingRaw, 1e15, 1e17);
        feePips = uint24(bound(uint256(feePips), 500, 5000));

        int256 amountRemaining = int256(amountRemainingRaw);

        vm.assume(sqrtPriceCurrentX96 != sqrtPriceTargetX96);

        (uint160 sqrtPriceNextX96,,,) =
            SwapMath.computeSwapStep(sqrtPriceCurrentX96, sqrtPriceTargetX96, liquidity, amountRemaining, feePips);

        // Price should be between current and target (inclusive)
        if (sqrtPriceTargetX96 > sqrtPriceCurrentX96) {
            assertGe(sqrtPriceNextX96, sqrtPriceCurrentX96, "Price below current");
            assertLe(sqrtPriceNextX96, sqrtPriceTargetX96, "Price overshot target");
        } else {
            assertLe(sqrtPriceNextX96, sqrtPriceCurrentX96, "Price above current");
            assertGe(sqrtPriceNextX96, sqrtPriceTargetX96, "Price overshot target");
        }
    }
}

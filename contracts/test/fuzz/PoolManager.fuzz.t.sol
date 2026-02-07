// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @title PoolManagerFuzzTest
/// @notice Fuzz tests for PoolManager contract
/// @dev Tests with 10,000+ randomized inputs
contract PoolManagerFuzzTest is Test {
    PoolManager public poolManager;
    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    function setUp() public {
        poolManager = new PoolManager();
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        // Ensure token0 < token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: Initialize
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test for pool initialization with random valid sqrt prices
    function testFuzz_Initialize_ValidSqrtPrice(uint160 sqrtPriceX96) public {
        // Bound to valid range
        sqrtPriceX96 = uint160(
            bound(uint256(sqrtPriceX96), uint256(TickMath.MIN_SQRT_PRICE), uint256(TickMath.MAX_SQRT_PRICE - 1))
        );

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        int24 tick = poolManager.initialize(key, sqrtPriceX96);

        // Verify initialization
        bytes32 poolId = keccak256(abi.encode(key));
        (uint160 storedSqrtPrice, int24 storedTick,,) = poolManager.getSlot0(poolId);

        assertEq(storedSqrtPrice, sqrtPriceX96, "Sqrt price mismatch");
        assertEq(storedTick, tick, "Tick mismatch");
    }

    /// @notice Fuzz test that initialization reverts with invalid sqrt prices
    function testFuzz_Initialize_RevertWhen_InvalidSqrtPrice(uint160 sqrtPriceX96) public {
        // Test values outside valid range
        vm.assume(sqrtPriceX96 < TickMath.MIN_SQRT_PRICE || sqrtPriceX96 >= TickMath.MAX_SQRT_PRICE);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(PoolManager.InvalidSqrtPrice.selector);
        poolManager.initialize(key, sqrtPriceX96);
    }

    /// @notice Fuzz test that double initialization always reverts
    function testFuzz_Initialize_RevertWhen_AlreadyInitialized(uint160 sqrtPriceX96) public {
        sqrtPriceX96 = uint160(
            bound(uint256(sqrtPriceX96), uint256(TickMath.MIN_SQRT_PRICE), uint256(TickMath.MAX_SQRT_PRICE - 1))
        );

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, sqrtPriceX96);

        vm.expectRevert(PoolManager.PoolAlreadyInitialized.selector);
        poolManager.initialize(key, sqrtPriceX96);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: ModifyLiquidity
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test for adding liquidity with random valid amounts
    function testFuzz_ModifyLiquidity_AddLiquidity(int256 liquidityDelta) public {
        // Bound to reasonable positive values
        liquidityDelta = int256(bound(uint256(liquidityDelta), 1e18, 1e30));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: liquidityDelta
        });

        int256 delta = poolManager.modifyLiquidity(key, params);

        // Verify liquidity was added
        bytes32 poolId = keccak256(abi.encode(key));
        uint128 liquidity = poolManager.getLiquidity(poolId);

        assertGt(liquidity, 0, "Liquidity should be greater than 0");
        assertEq(delta, liquidityDelta, "Delta mismatch");
    }

    /// @notice Fuzz test for removing liquidity
    function testFuzz_ModifyLiquidity_RemoveLiquidity(int256 addAmount, int256 removeAmount) public {
        // Bound amounts
        addAmount = int256(bound(uint256(addAmount), 1e18, 1e30));
        removeAmount = int256(bound(uint256(removeAmount), 1e18, uint256(addAmount)));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        // Add liquidity
        IPoolManager.ModifyLiquidityParams memory addParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: addAmount
        });

        poolManager.modifyLiquidity(key, addParams);

        // Remove liquidity
        IPoolManager.ModifyLiquidityParams memory removeParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: -removeAmount
        });

        int256 delta = poolManager.modifyLiquidity(key, removeParams);

        // Verify
        bytes32 poolId = keccak256(abi.encode(key));
        uint128 liquidity = poolManager.getLiquidity(poolId);

        assertEq(liquidity, uint128(uint256(addAmount - removeAmount)), "Liquidity mismatch");
        assertEq(delta, -removeAmount, "Delta mismatch");
    }

    /// @notice Fuzz test that removing more liquidity than available reverts
    function testFuzz_ModifyLiquidity_RevertWhen_InsufficientLiquidity(uint256 addAmount, uint256 removeAmount)
        public
    {
        addAmount = bound(addAmount, 1e18, 1e30);
        removeAmount = bound(removeAmount, addAmount + 1, type(uint128).max);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        // Add liquidity
        IPoolManager.ModifyLiquidityParams memory addParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: int256(addAmount)
        });

        poolManager.modifyLiquidity(key, addParams);

        // Try to remove more than available
        IPoolManager.ModifyLiquidityParams memory removeParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: -int256(removeAmount)
        });

        vm.expectRevert(PoolManager.InsufficientLiquidity.selector);
        poolManager.modifyLiquidity(key, removeParams);
    }

    /// @notice Fuzz test that invalid tick ranges revert
    function testFuzz_ModifyLiquidity_RevertWhen_InvalidTickRange(int24 tickLower, int24 tickUpper) public {
        // Ensure invalid range
        vm.assume(tickLower >= tickUpper);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: 1e18
        });

        vm.expectRevert();
        poolManager.modifyLiquidity(key, params);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FUZZ TEST: Swap
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Fuzz test for swaps with random amounts
    function testFuzz_Swap_ExactInput(int256 amountSpecified) public {
        // Bound to reasonable positive values
        amountSpecified = int256(bound(uint256(amountSpecified), 1e15, 1e20));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        // Add liquidity first
        IPoolManager.ModifyLiquidityParams memory liquidityParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 1e24
        });

        poolManager.modifyLiquidity(key, liquidityParams);

        // Perform swap
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify swap occurred
        assertGt(amount0, 0, "Amount0 should be positive (input)");
        assertLt(amount1, 0, "Amount1 should be negative (output)");
    }

    /// @notice Fuzz test that swaps without liquidity fail gracefully
    function testFuzz_Swap_WithoutLiquidity(int256 amountSpecified) public {
        amountSpecified = int256(bound(uint256(amountSpecified), 1e15, 1e20));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        // Should revert or return zero amounts (no liquidity)
        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // With no liquidity, amounts should be zero or swap should fail
        assertTrue(amount0 == 0 && amount1 == 0, "No swap should occur without liquidity");
    }

    /// @notice Fuzz test that swaps on uninitialized pools revert
    function testFuzz_Swap_RevertWhen_PoolNotInitialized(int256 amountSpecified) public {
        amountSpecified = int256(bound(uint256(amountSpecified), 1, 1e20));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        vm.expectRevert(PoolManager.PoolNotInitialized.selector);
        poolManager.swap(key, swapParams);
    }
}

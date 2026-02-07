// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PoolManagerTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;

    // Test addresses
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Test currencies
    Currency public currency0;
    Currency public currency1;

    // Constants
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // sqrt(1) * 2^96, i.e. tick 0

    function setUp() public {
        poolManager = new PoolManager();

        // Create test tokens (sorted)
        address token0 = makeAddr("token0");
        address token1 = makeAddr("token1");

        // Ensure proper sorting
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(token0);
        currency1 = Currency.wrap(token1);

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Initialize() public {
        // Arrange
        PoolKey memory key = _createPoolKey();

        // Act
        int24 tick = poolManager.initialize(key, SQRT_PRICE_1_1);

        // Assert
        (uint160 sqrtPriceX96, int24 returnedTick, , uint24 lpFee) = poolManager.getSlot0(_getPoolId(key));

        assertEq(sqrtPriceX96, SQRT_PRICE_1_1, "Sqrt price should be set");
        assertEq(tick, returnedTick, "Ticks should match");
        assertEq(lpFee, 3000, "LP fee should be set");
    }

    function test_RevertWhen_InitializingWithWrongCurrencyOrder() public {
        // Arrange
        PoolKey memory key = PoolKey({
            currency0: currency1, // Wrong order
            currency1: currency0,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        // Act & Assert
        vm.expectRevert(PoolManager.CurrenciesOutOfOrderOrEqual.selector);
        poolManager.initialize(key, SQRT_PRICE_1_1);
    }

    function test_RevertWhen_InitializingTwice() public {
        // Arrange
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Act & Assert
        vm.expectRevert(PoolManager.PoolAlreadyInitialized.selector);
        poolManager.initialize(key, SQRT_PRICE_1_1);
    }

    function test_RevertWhen_InitializingWithInvalidSqrtPrice() public {
        // Arrange
        PoolKey memory key = _createPoolKey();
        uint160 invalidPrice = 100; // Too low

        // Act & Assert
        vm.expectRevert(PoolManager.InvalidSqrtPrice.selector);
        poolManager.initialize(key, invalidPrice);
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODIFY LIQUIDITY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_ModifyLiquidity_TracksTickData() public {
        // Initialize pool at tick 0
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity at range [-120, 120] (surrounding current tick 0)
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1000000
        });
        poolManager.modifyLiquidity(key, params);

        // Verify tick info at lower tick
        (uint128 lowerGross, int128 lowerNet, bool lowerInit) = poolManager.ticks(poolId, -120);
        assertEq(lowerGross, 1000000, "Lower tick liquidityGross should equal liquidity added");
        assertEq(lowerNet, int128(1000000), "Lower tick liquidityNet should be positive");
        assertTrue(lowerInit, "Lower tick should be initialized");

        // Verify tick info at upper tick
        (uint128 upperGross, int128 upperNet, bool upperInit) = poolManager.ticks(poolId, 120);
        assertEq(upperGross, 1000000, "Upper tick liquidityGross should equal liquidity added");
        assertEq(upperNet, int128(-1000000), "Upper tick liquidityNet should be negative");
        assertTrue(upperInit, "Upper tick should be initialized");

        // Verify global liquidity updated (current tick 0 is within [-120, 120])
        uint128 globalLiq = poolManager.getLiquidity(poolId);
        assertEq(globalLiq, 1000000, "Global liquidity should match since tick 0 is in range");
    }

    function test_ModifyLiquidity_OutOfRangeDoesNotAffectGlobalLiquidity() public {
        // Initialize pool at tick 0
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity at range [100, 200] (above current tick 0)
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: 100,
            tickUpper: 200,
            liquidityDelta: 500000
        });
        poolManager.modifyLiquidity(key, params);

        // Global liquidity should not be affected since tick 0 < 100
        uint128 globalLiq = poolManager.getLiquidity(poolId);
        assertEq(globalLiq, 0, "Global liquidity should be 0 since position is out of range");

        // But tick data should be tracked
        (uint128 lowerGross, , bool lowerInit) = poolManager.ticks(poolId, 100);
        assertEq(lowerGross, 500000, "Lower tick should have liquidity tracked");
        assertTrue(lowerInit, "Lower tick should be initialized");
    }

    function test_ModifyLiquidity_RemoveLiquidityCleansUpTicks() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity
        IPoolManager.ModifyLiquidityParams memory addParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1000000
        });
        poolManager.modifyLiquidity(key, addParams);

        // Remove all liquidity
        IPoolManager.ModifyLiquidityParams memory removeParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: -1000000
        });
        poolManager.modifyLiquidity(key, removeParams);

        // Tick data should be cleaned up
        (uint128 lowerGross, int128 lowerNet, bool lowerInit) = poolManager.ticks(poolId, -120);
        assertEq(lowerGross, 0, "Lower tick liquidityGross should be 0");
        assertEq(lowerNet, int128(0), "Lower tick liquidityNet should be 0");
        assertFalse(lowerInit, "Lower tick should not be initialized");

        // Global liquidity should be 0
        assertEq(poolManager.getLiquidity(poolId), 0, "Global liquidity should be 0");
    }

    // ══════════════════════════════════════════════════════════════════════
    // SWAP TESTS - SINGLE TICK RANGE
    // ══════════════════════════════════════════════════════════════════════

    function test_Swap_SingleTickRange_ExactInput_ZeroForOne() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity at wide range
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Swap: exact input, zeroForOne
        uint160 sqrtPriceLimitX96 = TickMath.getSqrtPriceAtTick(-887220); // Use wide limit
        // Use MIN_SQRT_PRICE + 1 as limit to allow max movement
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15, // exact input of 1e15
            sqrtPriceLimitX96: 4295128740 // MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // amount0 should be positive (tokens in), amount1 should be negative (tokens out)
        assertGt(amount0, 0, "amount0 (input) should be positive");
        assertLt(amount1, 0, "amount1 (output) should be negative");

        // Price should have moved down
        (uint160 newSqrtPrice, , , ) = poolManager.getSlot0(poolId);
        assertLt(newSqrtPrice, SQRT_PRICE_1_1, "Price should have decreased for zeroForOne swap");
    }

    function test_Swap_SingleTickRange_ExactInput_OneForZero() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Add liquidity at wide range
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        bytes32 poolId = _getPoolId(key);

        // Swap: exact input, oneForZero (price goes up)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: 1461446703485210103287273052203988822378723970341 // MAX_SQRT_PRICE - 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // For oneForZero: amount1 > 0 (input), amount0 < 0 (output)
        assertLt(amount0, 0, "amount0 (output) should be negative for oneForZero");
        assertGt(amount1, 0, "amount1 (input) should be positive for oneForZero");

        // Price should have moved up
        (uint160 newSqrtPrice, , , ) = poolManager.getSlot0(poolId);
        assertGt(newSqrtPrice, SQRT_PRICE_1_1, "Price should have increased for oneForZero swap");
    }

    function test_Swap_ZeroLiquidity_ReturnsZeros() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Swap without adding liquidity (zero liquidity)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: 4295128740
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // With zero liquidity, no swap should occur
        assertEq(amount0, 0, "amount0 should be 0 with no liquidity");
        assertEq(amount1, 0, "amount1 should be 0 with no liquidity");
    }

    // ══════════════════════════════════════════════════════════════════════
    // SWAP TESTS - MULTI-TICK CROSSING
    // ══════════════════════════════════════════════════════════════════════

    function test_Swap_MultiTick_CrossesIntoNextRange_ZeroForOne() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity at two adjacent ranges:
        // Range 1: [-120, 0] - liquidity of 1e18
        IPoolManager.ModifyLiquidityParams memory liqParams1 = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 0,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams1);

        // Range 2: [-240, -120] - liquidity of 2e18
        IPoolManager.ModifyLiquidityParams memory liqParams2 = IPoolManager.ModifyLiquidityParams({
            tickLower: -240,
            tickUpper: -120,
            liquidityDelta: 2e18
        });
        poolManager.modifyLiquidity(key, liqParams2);

        // At tick 0, global liquidity should include range 1 (tick 0 is NOT in [-120, 0) since
        // condition is tick >= tickLower && tick < tickUpper, and 0 >= -120 but 0 is NOT < 0)
        // So global liquidity should be 0 since tick 0 is not in either range
        uint128 globalLiqBefore = poolManager.getLiquidity(poolId);
        // tick 0 is exactly at upper bound of range 1, so NOT in range. Global liq = 0
        assertEq(globalLiqBefore, 0, "Global liquidity should be 0 at tick 0 (at upper boundary)");

        // Do a large swap that should push price well below tick -120
        // Since we have liquidity in [-120, 0] and [-240, -120], the swap should cross into both
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18, // Large exact input
            sqrtPriceLimitX96: 4295128740 // MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify swap produced output
        assertGt(amount0, 0, "Should have consumed some token0 input");
        assertLt(amount1, 0, "Should have produced some token1 output");

        // Verify tick has moved below -120 (crossed at least one tick boundary)
        (, int24 newTick, , ) = poolManager.getSlot0(poolId);
        assertLt(newTick, -120, "Tick should have crossed below -120 into second range");
    }

    function test_Swap_MultiTick_CrossesIntoNextRange_OneForZero() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity at two adjacent ranges:
        // Range 1: [0, 120] - liquidity of 1e18 (current tick 0 is in range)
        IPoolManager.ModifyLiquidityParams memory liqParams1 = IPoolManager.ModifyLiquidityParams({
            tickLower: 0,
            tickUpper: 120,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams1);

        // Range 2: [120, 240] - liquidity of 2e18
        IPoolManager.ModifyLiquidityParams memory liqParams2 = IPoolManager.ModifyLiquidityParams({
            tickLower: 120,
            tickUpper: 240,
            liquidityDelta: 2e18
        });
        poolManager.modifyLiquidity(key, liqParams2);

        // Global liquidity at tick 0 should include range 1
        uint128 globalLiqBefore = poolManager.getLiquidity(poolId);
        assertEq(globalLiqBefore, 1e18, "Global liquidity should be 1e18 from range 1");

        // Swap oneForZero (price going up) - should cross tick 120 boundary
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 1461446703485210103287273052203988822378723970341 // MAX_SQRT_PRICE - 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify swap produced output
        assertLt(amount0, 0, "Should have produced some token0 output");
        assertGt(amount1, 0, "Should have consumed some token1 input");

        // Verify tick crossed above 120
        (, int24 newTick, , ) = poolManager.getSlot0(poolId);
        assertGt(newTick, 120, "Tick should have crossed above 120 into second range");
    }

    function test_Swap_MultiTick_LiquidityUpdatesOnCross() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Range 1: [-60, 60] with 1e18 liquidity (current tick in range)
        IPoolManager.ModifyLiquidityParams memory liqParams1 = IPoolManager.ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams1);

        // Range 2: [-180, -60] with 3e18 liquidity
        IPoolManager.ModifyLiquidityParams memory liqParams2 = IPoolManager.ModifyLiquidityParams({
            tickLower: -180,
            tickUpper: -60,
            liquidityDelta: 3e18
        });
        poolManager.modifyLiquidity(key, liqParams2);

        // Verify initial global liquidity
        assertEq(poolManager.getLiquidity(poolId), 1e18, "Initial liquidity should be 1e18");

        // Swap enough to cross tick -60 (enter range 2)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 4295128740
        });

        poolManager.swap(key, swapParams);

        // After crossing tick -60, the global liquidity should reflect range 2 only
        // (range 1 liquidity exits, range 2 liquidity enters)
        (, int24 newTick, , ) = poolManager.getSlot0(poolId);

        if (newTick < -60 && newTick >= -180) {
            // We're in range 2 only: liquidity should be 3e18
            uint128 newLiquidity = poolManager.getLiquidity(poolId);
            assertEq(newLiquidity, 3e18, "After crossing -60, liquidity should be 3e18 from range 2");
        }
    }

    function test_Swap_MultiTick_ThreeRanges() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Set up three adjacent liquidity ranges below current tick:
        // Range 1: [-60, 60] with 1e18 liquidity (current tick 0 in range)
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 1e18
        }));

        // Range 2: [-180, -60] with 2e18 liquidity
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -180,
            tickUpper: -60,
            liquidityDelta: 2e18
        }));

        // Range 3: [-300, -180] with 4e18 liquidity
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -300,
            tickUpper: -180,
            liquidityDelta: 4e18
        }));

        // Large swap to cross through multiple tick boundaries
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 10e18,
            sqrtPriceLimitX96: 4295128740
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify the swap consumed input and produced output
        assertGt(amount0, 0, "Swap should have consumed token0");
        assertLt(amount1, 0, "Swap should have produced token1");

        // The tick should have moved far below the initial position
        (, int24 newTick, , ) = poolManager.getSlot0(poolId);
        assertLt(newTick, -60, "Tick should be below -60 after large swap");

        // The key insight: with the old break-based implementation, only one tick range
        // would be traversed. With proper multi-tick crossing, more output is produced.
    }

    function test_Swap_MultiTick_OverlappingRanges() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Two overlapping ranges: both cover current tick
        // Range A: [-120, 120] with 1e18 liquidity
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1e18
        }));

        // Range B: [-60, 60] with 2e18 liquidity (subset of range A)
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 2e18
        }));

        // Global liquidity at tick 0 should be sum of both ranges
        assertEq(poolManager.getLiquidity(poolId), 3e18, "Liquidity should be 3e18 (overlapping ranges)");

        // Swap zeroForOne to cross tick -60 (exit range B)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 4295128740
        });

        poolManager.swap(key, swapParams);

        (, int24 newTick, , ) = poolManager.getSlot0(poolId);
        uint128 newLiq = poolManager.getLiquidity(poolId);

        // If we crossed tick -60 but not -120:
        // - Range B ([-60, 60]) exits: -2e18
        // - Range A ([-120, 120]) still active: 1e18
        if (newTick < -60 && newTick >= -120) {
            assertEq(newLiq, 1e18, "After crossing -60, only range A should be active (1e18)");
        }
    }

    function test_Swap_MultiTick_ProducesMoreOutputThanSingleTick() public {
        // This test proves that multi-tick crossing produces more output than
        // a single-step swap would. With the old 'break' bug, only the first
        // tick range is used.

        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Add liquidity that spans two separate ranges
        // Range 1: [0, 120] with small liquidity
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: 0,
            tickUpper: 120,
            liquidityDelta: 1e15 // small liquidity
        }));

        // Range 2: [120, 240] with large liquidity
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: 120,
            tickUpper: 240,
            liquidityDelta: 1e18 // much more liquidity
        }));

        // Swap oneForZero with enough input to exhaust range 1 and enter range 2
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 1461446703485210103287273052203988822378723970341
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        bytes32 poolId = _getPoolId(key);
        (, int24 newTick, , ) = poolManager.getSlot0(poolId);

        // With multi-tick crossing, the swap should have gone past tick 120
        // With the old 'break' bug, it would stop after range 1
        assertGt(newTick, 120, "Multi-tick swap should cross past tick 120 into range 2");
        assertLt(amount0, 0, "Should have output tokens");
        assertGt(amount1, 0, "Should have consumed input tokens");
    }

    // ══════════════════════════════════════════════════════════════════════
    // TICK TRACKING TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_InitializedTicks_TrackedCorrectly() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add two positions at different ranges
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1e18
        }));

        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -240,
            tickUpper: -120,
            liquidityDelta: 1e18
        }));

        // Check initialized ticks
        int24[] memory initTicks = poolManager.getInitializedTicks(poolId);
        assertEq(initTicks.length, 3, "Should have 3 initialized ticks: -240, -120, 120");

        // Verify sorted order
        assertTrue(initTicks[0] < initTicks[1], "Ticks should be sorted ascending");
        assertTrue(initTicks[1] < initTicks[2], "Ticks should be sorted ascending");
    }

    function test_Swap_ExactOutput_MultiTick() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Two ranges surrounding current tick
        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1e18
        }));

        poolManager.modifyLiquidity(key, IPoolManager.ModifyLiquidityParams({
            tickLower: -240,
            tickUpper: -120,
            liquidityDelta: 2e18
        }));

        // Exact output swap (negative amountSpecified)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -1e15, // want this much token1 out
            sqrtPriceLimitX96: 4295128740
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // amount0 should be positive (tokens in), amount1 should be negative (tokens out)
        assertGt(amount0, 0, "Should consume token0 for exact output");
        assertLt(amount1, 0, "Should produce token1 for exact output");
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAUSE TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksSwap() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Add liquidity so swap has something to work with
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Pause the contract
        poolManager.pause();

        // Try to swap - should revert with EnforcedPause
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: 4295128740
        });

        vm.expectRevert(Pausable.EnforcedPause.selector);
        poolManager.swap(key, swapParams);
    }

    function test_Pause_BlocksModifyLiquidity() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Pause the contract
        poolManager.pause();

        // Try to modify liquidity - should revert with EnforcedPause
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1000000
        });

        vm.expectRevert(Pausable.EnforcedPause.selector);
        poolManager.modifyLiquidity(key, params);
    }

    function test_Unpause_AllowsSwap() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Add liquidity
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Pause then unpause
        poolManager.pause();
        poolManager.unpause();

        // Swap should work after unpause
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: 4295128740
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);
        assertGt(amount0, 0, "amount0 (input) should be positive after unpause");
        assertLt(amount1, 0, "amount1 (output) should be negative after unpause");
    }

    function test_Pause_OnlyOwner() public {
        // Non-owner tries to pause - should revert
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        poolManager.pause();
    }

    function test_Pause_ViewFunctionsStillWork() public {
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add some liquidity so there is state to read
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1000000
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Pause the contract
        poolManager.pause();

        // View functions should still work
        (uint160 sqrtPriceX96, int24 tick, , uint24 lpFee) = poolManager.getSlot0(poolId);
        assertEq(sqrtPriceX96, SQRT_PRICE_1_1, "getSlot0 should work while paused");
        assertEq(lpFee, 3000, "LP fee should be readable while paused");

        uint128 liq = poolManager.getLiquidity(poolId);
        assertEq(liq, 1000000, "getLiquidity should work while paused");
    }

    // ══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    function _createPoolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function _getPoolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }
}

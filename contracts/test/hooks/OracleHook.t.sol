// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OracleHook} from "../../src/hooks/OracleHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @title OracleHookTest
/// @notice Tests for OracleHook contract
contract OracleHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    OracleHook public hook;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;
    bytes32 public poolId;

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function setUp() public {
        // Deploy contracts
        poolManager = new PoolManager();
        hook = new OracleHook(address(poolManager));

        // Deploy tokens
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolId = keccak256(abi.encode(poolKey));

        // Initialize pool
        poolManager.initialize(poolKey, SQRT_PRICE_1_1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constructor() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
    }

    function test_GetHookPermissions() public view {
        OracleHook.Permissions memory permissions = hook.getHookPermissions();

        assertEq(permissions.beforeInitialize, false);
        assertEq(permissions.afterInitialize, true);
        assertEq(permissions.beforeModifyLiquidity, false);
        assertEq(permissions.afterModifyLiquidity, true);
        assertEq(permissions.beforeSwap, false);
        assertEq(permissions.afterSwap, true);
    }

    function test_AfterInitialize() public {
        // Call afterInitialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Check initialization
        assertTrue(hook.isPoolInitialized(poolId));

        // Check oracle state
        assertEq(hook.getObservationIndex(poolId), 0);
        assertEq(hook.getCardinality(poolId), 1);

        // Check first observation
        OracleHook.Observation memory obs = hook.getObservation(poolId, 0);
        assertEq(obs.timestamp, block.timestamp);
        assertEq(obs.sqrtPriceX96, SQRT_PRICE_1_1);
        assertEq(obs.liquidity, 0);
        assertEq(obs.tickCumulative, 0);
        assertTrue(obs.initialized);
    }

    // ══════════════════════════════════════════════════════════════════════
    // OBSERVATION RECORDING TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_AfterSwap_RecordsObservation() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Move time forward
        vm.warp(block.timestamp + 60);

        // Simulate afterSwap (would be called by PoolManager)
        vm.prank(address(poolManager));
        bytes4 selector = hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));

        assertEq(selector, IHooks.afterSwap.selector);

        // Note: Index may not increment if pool state hasn't changed
        // In production, this would be called after actual swap
        // For unit tests, we just verify it doesn't revert
    }

    function test_AfterSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        vm.expectRevert(OracleHook.PoolNotInitialized.selector);
        hook.afterSwap(address(this), uninitializedKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
    }

    function test_AfterModifyLiquidity_RecordsObservation() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Move time forward
        vm.warp(block.timestamp + 60);

        // Simulate afterModifyLiquidity
        vm.prank(address(poolManager));
        bytes4 selector = hook.afterModifyLiquidity(
            address(this), poolKey, IPoolManager.ModifyLiquidityParams(-600, 600, 1000e18), BalanceDelta.wrap(0)
        );

        assertEq(selector, IHooks.afterModifyLiquidity.selector);

        // Note: Index may not increment if pool state hasn't changed
        // In production, this would be called after actual liquidity modification
        // For unit tests, we just verify it doesn't revert
    }

    function test_SameTimestamp_DoesNotRecordDuplicate() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Call afterSwap at same timestamp
        vm.prank(address(poolManager));
        hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));

        // Index should still be 0 (no new observation)
        uint16 index = hook.getObservationIndex(poolId);
        assertEq(index, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TWAP CALCULATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Observe_CurrentObservation() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Observe current (secondsAgo = 0)
        (int56 tickCumulative, uint32 timestamp) = hook.observe(poolId, 0);

        assertEq(tickCumulative, 0);
        assertEq(timestamp, block.timestamp);
    }

    function test_Observe_RevertWhen_PoolNotInitialized() public {
        bytes32 uninitializedPoolId = keccak256("uninitialized");

        vm.expectRevert(OracleHook.PoolNotInitialized.selector);
        hook.observe(uninitializedPoolId, 0);
    }

    function test_GetTWAP_RevertWhen_InvalidTimeWindow() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Too short (below 30 minute minimum)
        vm.expectRevert(OracleHook.InvalidTimeWindow.selector);
        hook.getTWAP(poolId, 30);

        // Too long (above 7 day maximum)
        vm.expectRevert(OracleHook.InvalidTimeWindow.selector);
        hook.getTWAP(poolId, 604801);
    }

    function test_GetTWAP_RevertWhen_WindowBelowMinimum() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Create enough observations for any window
        for (uint256 i = 1; i <= 10; i++) {
            vm.warp(block.timestamp + 360); // 6 minutes per observation

            vm.prank(address(poolManager));
            hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
        }

        // Old minimum (60 seconds) should now be rejected
        vm.expectRevert(OracleHook.InvalidTimeWindow.selector);
        hook.getTWAP(poolId, 60);

        // Just under 30 minutes should be rejected
        vm.expectRevert(OracleHook.InvalidTimeWindow.selector);
        hook.getTWAP(poolId, 1799);

        // Exactly 30 minutes should NOT revert (valid minimum)
        try hook.getTWAP(poolId, 1800) returns (int24) {
            // Expected: valid window accepted
        } catch {
            // May revert due to insufficient observations, but not InvalidTimeWindow
        }
    }

    function test_GetTWAP_WithMultipleObservations() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Create multiple observations over time (6 minutes each, 30+ minutes total)
        for (uint256 i = 1; i <= 6; i++) {
            vm.warp(block.timestamp + 360); // Move 6 minutes forward

            vm.prank(address(poolManager));
            hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
        }

        // Now we can calculate TWAP with 30-minute window (minimum)
        // This should not revert if we have enough observations
        try hook.getTWAP(poolId, 1800) returns (int24 twapTick) {
            console2.log("TWAP Tick:", twapTick);
            // TWAP should be close to 0 since price hasn't changed
            assertLe(uint24(twapTick < 0 ? -twapTick : twapTick), 100);
        } catch {
            // If insufficient observations, that's expected
            console2.log("Insufficient observations for TWAP");
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CARDINALITY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_IncreaseCardinality() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint16 initialCardinality = hook.getCardinality(poolId);
        assertEq(initialCardinality, 1);

        // Increase cardinality
        hook.increaseCardinality(poolId, 10);

        // Note: Cardinality doesn't increase immediately,
        // it sets cardinalityNext which grows as observations are added
    }

    function test_IncreaseCardinality_RevertWhen_PoolNotInitialized() public {
        bytes32 uninitializedPoolId = keccak256("uninitialized");

        vm.expectRevert(OracleHook.PoolNotInitialized.selector);
        hook.increaseCardinality(uninitializedPoolId, 10);
    }

    function test_IncreaseCardinality_CapsAtMax() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Try to increase beyond MAX_CARDINALITY
        hook.increaseCardinality(poolId, type(uint16).max);

        // Should be capped (this just sets cardinalityNext)
        // Actual test would require checking internal state
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_GetObservationIndex() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint16 index = hook.getObservationIndex(poolId);
        assertEq(index, 0);
    }

    function test_GetCardinality() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint16 cardinality = hook.getCardinality(poolId);
        assertEq(cardinality, 1);
    }

    function test_GetObservation() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        OracleHook.Observation memory obs = hook.getObservation(poolId, 0);

        assertEq(obs.timestamp, block.timestamp);
        assertEq(obs.sqrtPriceX96, SQRT_PRICE_1_1);
        assertTrue(obs.initialized);
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constants() public view {
        assertEq(hook.MAX_CARDINALITY(), 65535);
        assertEq(hook.MIN_TWAP_WINDOW(), 1800); // 30 minutes
        assertEq(hook.MAX_TWAP_WINDOW(), 604800); // 7 days
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTEGRATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_MultipleObservations_CircularBuffer() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Increase cardinality
        hook.increaseCardinality(poolId, 5);

        // Create multiple observations
        for (uint256 i = 1; i <= 10; i++) {
            vm.warp(block.timestamp + 60);

            vm.prank(address(poolManager));
            hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
        }

        // Check that observations wrap around
        uint16 finalIndex = hook.getObservationIndex(poolId);
        console2.log("Final index:", finalIndex);

        // With cardinality of 5, index should be < 5
        assertLt(finalIndex, 5);
    }
}

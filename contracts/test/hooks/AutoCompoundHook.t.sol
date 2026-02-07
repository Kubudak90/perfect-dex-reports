// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AutoCompoundHook} from "../../src/hooks/AutoCompoundHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AutoCompoundHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    AutoCompoundHook public hook;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;
    bytes32 public poolId;

    address public alice;
    address public bob;

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function setUp() public {
        poolManager = new PoolManager();
        hook = new AutoCompoundHook(address(poolManager));

        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        alice = makeAddr("alice");
        bob = makeAddr("bob");

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolId = keccak256(abi.encode(poolKey));

        poolManager.initialize(poolKey, SQRT_PRICE_1_1);
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Simulate a swap by calling afterSwap with a given delta
    /// @dev This simulates the fee accumulation that would happen during a real swap
    function _simulateSwap(bool zeroForOne, int256 swapAmount) internal {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: swapAmount,
            sqrtPriceLimitX96: 0
        });

        // The delta represents the swap amounts flowing through the pool
        BalanceDelta delta = BalanceDelta.wrap(swapAmount);

        hook.afterSwap(
            address(this),
            poolKey,
            params,
            delta
        );
    }

    /// @notice Register a position and add liquidity to the pool manager so getLiquidity returns non-zero
    function _registerPositionWithLiquidity(
        address user,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal returns (uint256 positionId) {
        // Add matching liquidity to the pool manager
        IPoolManager.ModifyLiquidityParams memory modifyParams = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(uint256(liquidity))
        });
        poolManager.modifyLiquidity(poolKey, modifyParams);

        // Register position in the hook
        vm.prank(user);
        positionId = hook.registerPosition(poolKey, tickLower, tickUpper, liquidity);
    }

    // ══════════════════════════════════════════════════════════════════════
    // EXISTING TESTS (preserved)
    // ══════════════════════════════════════════════════════════════════════

    function test_Constructor() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
        assertEq(hook.owner(), address(this));
        assertEq(hook.feeCollector(), address(this));
        assertEq(hook.nextPositionId(), 1);
    }

    function test_AfterInitialize() public {
        assertTrue(hook.isPoolInitialized(poolId));

        AutoCompoundHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        assertTrue(config.compoundingEnabled);
        assertEq(config.minCompoundInterval, hook.DEFAULT_MIN_COMPOUND_INTERVAL());
        assertEq(config.minFeesRequired, hook.DEFAULT_MIN_FEES());
        assertEq(config.compoundFee, hook.DEFAULT_COMPOUND_FEE());
    }

    function test_AfterInitialize_StoresPoolKey() public {
        PoolKey memory storedKey = hook.getPoolKey(poolId);
        assertEq(Currency.unwrap(storedKey.currency0), Currency.unwrap(poolKey.currency0));
        assertEq(Currency.unwrap(storedKey.currency1), Currency.unwrap(poolKey.currency1));
        assertEq(storedKey.fee, poolKey.fee);
        assertEq(storedKey.tickSpacing, poolKey.tickSpacing);
    }

    function test_RegisterPosition() public {
        vm.startPrank(alice);

        uint256 positionId = hook.registerPosition(
            poolKey,
            -600, // tickLower
            600,  // tickUpper
            1000 ether // liquidity
        );

        assertEq(positionId, 1);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.owner, alice);
        assertEq(position.poolId, poolId);
        assertEq(position.tickLower, -600);
        assertEq(position.tickUpper, 600);
        assertEq(position.liquidity, 1000 ether);
        assertTrue(position.autoCompoundEnabled);

        vm.stopPrank();
    }

    function test_RegisterPosition_RevertWhen_ZeroLiquidity() public {
        vm.expectRevert(AutoCompoundHook.InvalidAmount.selector);
        hook.registerPosition(poolKey, -600, 600, 0);
    }

    function test_EnableAutoCompound() public {
        vm.startPrank(alice);

        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        // Disable first
        hook.disableAutoCompound(positionId);
        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertFalse(position.autoCompoundEnabled);

        // Re-enable
        hook.enableAutoCompound(positionId);
        position = hook.getPosition(positionId);
        assertTrue(position.autoCompoundEnabled);

        vm.stopPrank();
    }

    function test_DisableAutoCompound() public {
        vm.startPrank(alice);

        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        hook.disableAutoCompound(positionId);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertFalse(position.autoCompoundEnabled);

        vm.stopPrank();
    }

    function test_DisableAutoCompound_RevertWhen_NotOwner() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        vm.prank(bob);
        vm.expectRevert(AutoCompoundHook.Unauthorized.selector);
        hook.disableAutoCompound(positionId);
    }

    function test_GetUserPositions() public {
        vm.startPrank(alice);

        hook.registerPosition(poolKey, -600, 600, 1000 ether);
        hook.registerPosition(poolKey, -300, 300, 500 ether);

        uint256[] memory positions = hook.getUserPositions(alice);
        assertEq(positions.length, 2);
        assertEq(positions[0], 1);
        assertEq(positions[1], 2);

        vm.stopPrank();
    }

    function test_GetPoolConfig() public view {
        AutoCompoundHook.PoolConfig memory config = hook.getPoolConfig(poolId);

        assertTrue(config.compoundingEnabled);
        assertEq(config.minCompoundInterval, 3600);
        assertEq(config.minFeesRequired, 1e15);
        assertEq(config.compoundFee, 10);
    }

    function test_IsReadyForCompound() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        // Not ready initially (no fees)
        assertFalse(hook.isReadyForCompound(positionId));
    }

    function test_GetEstimatedCompound() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        (
            uint256 fees0,
            uint256 fees1,
            uint128 estimatedLiquidity
        ) = hook.getEstimatedCompound(positionId);

        assertEq(fees0, 0);
        assertEq(fees1, 0);
        assertEq(estimatedLiquidity, 0);
    }

    function test_UpdatePoolConfig() public {
        hook.updatePoolConfig(
            poolId,
            true,   // compoundingEnabled
            7200,   // minCompoundInterval (2 hours)
            2e15,   // minFeesRequired
            20      // compoundFee (0.2%)
        );

        AutoCompoundHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        assertTrue(config.compoundingEnabled);
        assertEq(config.minCompoundInterval, 7200);
        assertEq(config.minFeesRequired, 2e15);
        assertEq(config.compoundFee, 20);
    }

    function test_UpdatePoolConfig_RevertWhen_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook.updatePoolConfig(poolId, true, 7200, 2e15, 20);
    }

    function test_UpdatePoolConfig_RevertWhen_FeeTooHigh() public {
        vm.expectRevert(AutoCompoundHook.InvalidAmount.selector);
        hook.updatePoolConfig(poolId, true, 7200, 2e15, 200); // > MAX_COMPOUND_FEE
    }

    function test_SetFeeCollector() public {
        address newCollector = makeAddr("newCollector");

        hook.setFeeCollector(newCollector);
        assertEq(hook.feeCollector(), newCollector);
    }

    function test_SetFeeCollector_RevertWhen_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook.setFeeCollector(alice);
    }

    function test_SetFeeCollector_RevertWhen_ZeroAddress() public {
        vm.expectRevert(AutoCompoundHook.InvalidAmount.selector);
        hook.setFeeCollector(address(0));
    }

    function test_TransferOwnership_TwoStep() public {
        // Step 1: Propose transfer
        hook.transferOwnership(alice);
        assertEq(hook.pendingOwner(), alice);
        assertEq(hook.owner(), address(this));

        // Step 2: Accept
        vm.prank(alice);
        hook.acceptOwnership();
        assertEq(hook.owner(), alice);
    }

    function test_TransferOwnership_RevertWhen_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook.transferOwnership(alice);
    }

    function test_GetHookPermissions() public view {
        AutoCompoundHook.Permissions memory permissions = hook.getHookPermissions();

        assertFalse(permissions.beforeInitialize);
        assertTrue(permissions.afterInitialize);
        assertFalse(permissions.beforeModifyLiquidity);
        assertTrue(permissions.afterModifyLiquidity);
        assertFalse(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
    }

    function test_AfterModifyLiquidity() public {
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 1000 ether
        });

        bytes4 selector = hook.afterModifyLiquidity(
            address(this),
            poolKey,
            params,
            BalanceDelta.wrap(0)
        );

        assertEq(selector, IHooks.afterModifyLiquidity.selector);
    }

    function test_AfterSwap() public {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 100 ether,
            sqrtPriceLimitX96: 0
        });

        bytes4 selector = hook.afterSwap(
            address(this),
            poolKey,
            params,
            BalanceDelta.wrap(0)
        );

        assertEq(selector, IHooks.afterSwap.selector);
    }

    function test_GetTotalCompounded() public view {
        uint256 total = hook.getTotalCompounded(poolId);
        assertEq(total, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: Fee Accumulation
    // ══════════════════════════════════════════════════════════════════════

    function test_FeesAccumulateAfterSwap_ZeroForOne() public {
        // Use default config (minCompoundInterval=3600) so auto-compound doesn't fire
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate a swap (zeroForOne) with a positive delta of 10 ether
        _simulateSwap(true, 10 ether);

        // Check that fees accumulated in token0 (since zeroForOne means token0 is input)
        AutoCompoundHook.Position memory position = hook.getPosition(positionId);

        // Fee calculation: swapAmount * feeRate / 1_000_000
        // 10 ether * 3000 / 1_000_000 = 0.03 ether = 3e16
        uint256 expectedFees = (10 ether * 3000) / 1_000_000;
        assertEq(position.fees0Accumulated, expectedFees);
        assertEq(position.fees1Accumulated, 0);
    }

    function test_FeesAccumulateAfterSwap_OneForZero() public {
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate a swap (oneForZero) with a positive delta of 5 ether
        _simulateSwap(false, 5 ether);

        // Fees should accumulate in token1 (since oneForZero means token1 is input)
        AutoCompoundHook.Position memory position = hook.getPosition(positionId);

        uint256 expectedFees = (5 ether * 3000) / 1_000_000;
        assertEq(position.fees0Accumulated, 0);
        assertEq(position.fees1Accumulated, expectedFees);
    }

    function test_FeesAccumulateAcrossMultipleSwaps() public {
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate multiple swaps
        _simulateSwap(true, 10 ether);
        _simulateSwap(true, 20 ether);
        _simulateSwap(false, 5 ether);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);

        // token0 fees: (10 + 20) * 3000 / 1_000_000 = 9e16
        uint256 expectedFees0 = (30 ether * 3000) / 1_000_000;
        // token1 fees: 5 * 3000 / 1_000_000 = 1.5e16
        uint256 expectedFees1 = (5 ether * 3000) / 1_000_000;

        assertEq(position.fees0Accumulated, expectedFees0);
        assertEq(position.fees1Accumulated, expectedFees1);
    }

    function test_FeesDistributedProportionally() public {
        // Register two positions with different liquidity amounts
        // Alice has 750 ether, Bob has 250 ether = total 1000 ether in pool
        uint256 posId1 = _registerPositionWithLiquidity(alice, -600, 600, 750 ether);
        uint256 posId2 = _registerPositionWithLiquidity(bob, -600, 600, 250 ether);

        // Simulate a swap
        _simulateSwap(true, 100 ether);

        AutoCompoundHook.Position memory pos1 = hook.getPosition(posId1);
        AutoCompoundHook.Position memory pos2 = hook.getPosition(posId2);

        // Total fees: 100 ether * 3000 / 1_000_000 = 0.3 ether
        uint256 totalFee = (100 ether * 3000) / 1_000_000;

        // Alice should get 75% (750/1000)
        uint256 aliceExpected = (totalFee * 750 ether) / 1000 ether;
        // Bob should get 25% (250/1000)
        uint256 bobExpected = (totalFee * 250 ether) / 1000 ether;

        assertEq(pos1.fees0Accumulated, aliceExpected);
        assertEq(pos2.fees0Accumulated, bobExpected);
    }

    function test_NoFeesWhenZeroDelta() public {
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate a swap with zero delta
        _simulateSwap(true, 0);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.fees0Accumulated, 0);
        assertEq(position.fees1Accumulated, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: Compound Execution
    // ══════════════════════════════════════════════════════════════════════

    function test_CompoundPosition_AfterFeesAccumulate() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        // minFeesRequired=1 so any accumulated fees allow manual compound
        hook.updatePoolConfig(poolId, true, 7200, 1, 10);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate a large swap so fees accumulate above threshold
        _simulateSwap(true, 100 ether);

        AutoCompoundHook.Position memory posBefore = hook.getPosition(positionId);
        uint256 fees0Before = posBefore.fees0Accumulated;
        assertTrue(fees0Before > 0, "Fees should have accumulated");

        // Advance time past compound interval
        vm.warp(block.timestamp + 7201);

        // Compound the position
        uint128 liquidityAdded = hook.compoundPosition(positionId);

        // Verify liquidity was added
        assertTrue(liquidityAdded > 0, "Liquidity should have been added");

        // Verify fees were cleared
        AutoCompoundHook.Position memory posAfter = hook.getPosition(positionId);
        assertEq(posAfter.fees0Accumulated, 0);
        assertEq(posAfter.fees1Accumulated, 0);

        // Verify liquidity increased
        assertTrue(posAfter.liquidity > posBefore.liquidity, "Position liquidity should increase");

        // Verify total compounded tracking
        assertTrue(hook.getTotalCompounded(poolId) > 0, "Total compounded should increase");
    }

    function test_CompoundPosition_UpdatesLiquidityProperly() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1, 0);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate swap to accumulate fees
        _simulateSwap(true, 100 ether);

        uint128 liquidityBefore = hook.getPosition(positionId).liquidity;

        vm.warp(block.timestamp + 7201);

        uint128 liquidityAdded = hook.compoundPosition(positionId);

        AutoCompoundHook.Position memory posAfter = hook.getPosition(positionId);
        assertEq(posAfter.liquidity, liquidityBefore + liquidityAdded);
    }

    function test_CompoundPosition_RevertWhen_InsufficientFees() public {
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // No swaps = no fees, should revert
        vm.warp(block.timestamp + 3601); // past min interval

        vm.expectRevert(AutoCompoundHook.InsufficientFees.selector);
        hook.compoundPosition(positionId);
    }

    function test_CompoundPosition_RevertWhen_TooSoon() public {
        hook.updatePoolConfig(poolId, true, 3600, 1, 10);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate swap to accumulate fees
        _simulateSwap(true, 100 ether);

        // Don't advance time - should revert with CompoundTooSoon
        vm.expectRevert(AutoCompoundHook.CompoundTooSoon.selector);
        hook.compoundPosition(positionId);
    }

    function test_IsReadyForCompound_AfterFeesAccumulate() public {
        // Use high minCompoundInterval so auto-compound won't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1e15, 10);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Not ready before swap
        assertFalse(hook.isReadyForCompound(positionId));

        // Simulate a large swap to accumulate enough fees (need >= 1e15)
        // Need: swapAmount * 3000 / 1_000_000 >= 1e15
        // swapAmount >= 1e15 * 1_000_000 / 3000 = 333.33 ether
        _simulateSwap(true, 400 ether);

        // Must also advance time past minCompoundInterval
        vm.warp(block.timestamp + 7201);

        // Now should be ready
        assertTrue(hook.isReadyForCompound(positionId));
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: Fee Collector
    // ══════════════════════════════════════════════════════════════════════

    function test_FeeCollectorReceivesShare() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1, 50);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate swap to accumulate fees
        _simulateSwap(true, 100 ether);

        AutoCompoundHook.Position memory posBefore = hook.getPosition(positionId);
        uint256 fees0 = posBefore.fees0Accumulated;
        assertTrue(fees0 > 0, "Should have accumulated fees");

        // Expected compound fee: fees * 50 / 10000 = fees * 0.5%
        uint256 expectedFeeCollectorAmount = (fees0 * 50) / 10000;

        vm.warp(block.timestamp + 7201);
        hook.compoundPosition(positionId);

        // Check fee collector balance
        address token0Addr = Currency.unwrap(currency0);
        uint256 collectorBalance = hook.getFeeCollectorBalance(token0Addr);
        assertEq(collectorBalance, expectedFeeCollectorAmount);
    }

    function test_FeeCollectorBalanceAccumulatesAcrossCompounds() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1, 50);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        address token0Addr = Currency.unwrap(currency0);

        // First compound cycle
        _simulateSwap(true, 100 ether);
        AutoCompoundHook.Position memory pos1 = hook.getPosition(positionId);
        uint256 expectedFee1 = (pos1.fees0Accumulated * 50) / 10000;

        vm.warp(block.timestamp + 7201);
        hook.compoundPosition(positionId);

        uint256 balance1 = hook.getFeeCollectorBalance(token0Addr);
        assertEq(balance1, expectedFee1);

        // Second compound cycle
        _simulateSwap(true, 200 ether);
        AutoCompoundHook.Position memory pos2 = hook.getPosition(positionId);
        uint256 expectedFee2 = (pos2.fees0Accumulated * 50) / 10000;

        vm.warp(block.timestamp + 7201);
        hook.compoundPosition(positionId);

        uint256 balance2 = hook.getFeeCollectorBalance(token0Addr);
        assertEq(balance2, expectedFee1 + expectedFee2);
    }

    function test_WithdrawFees() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1, 50);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        _simulateSwap(true, 100 ether);
        vm.warp(block.timestamp + 7201);
        hook.compoundPosition(positionId);

        address token0Addr = Currency.unwrap(currency0);
        uint256 balanceBefore = hook.getFeeCollectorBalance(token0Addr);
        assertTrue(balanceBefore > 0, "Should have accumulated fees");

        // Withdraw as fee collector (which is address(this) by default)
        hook.withdrawFees(token0Addr);

        // Balance should be zeroed
        assertEq(hook.getFeeCollectorBalance(token0Addr), 0);
    }

    function test_WithdrawFees_RevertWhen_Unauthorized() public {
        address token0Addr = Currency.unwrap(currency0);

        vm.prank(alice);
        vm.expectRevert(AutoCompoundHook.Unauthorized.selector);
        hook.withdrawFees(token0Addr);
    }

    function test_WithdrawFees_RevertWhen_NothingToWithdraw() public {
        address token0Addr = Currency.unwrap(currency0);

        vm.expectRevert(AutoCompoundHook.NothingToWithdraw.selector);
        hook.withdrawFees(token0Addr);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: afterModifyLiquidity Position Tracking
    // ══════════════════════════════════════════════════════════════════════

    function test_AfterModifyLiquidity_UpdatesPositionLiquidity() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        // Simulate liquidity addition via afterModifyLiquidity
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 500 ether
        });

        hook.afterModifyLiquidity(alice, poolKey, params, BalanceDelta.wrap(0));

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.liquidity, 1500 ether); // 1000 + 500
    }

    function test_AfterModifyLiquidity_DecreasesPositionLiquidity() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        // Simulate liquidity removal via afterModifyLiquidity
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: -300 ether
        });

        hook.afterModifyLiquidity(alice, poolKey, params, BalanceDelta.wrap(0));

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.liquidity, 700 ether); // 1000 - 300
    }

    function test_AfterModifyLiquidity_DoesNotAffectUnmatchedPositions() public {
        vm.prank(alice);
        uint256 positionId = hook.registerPosition(poolKey, -600, 600, 1000 ether);

        // Different tick range should not affect alice's position
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -300,
            tickUpper: 300,
            liquidityDelta: 500 ether
        });

        hook.afterModifyLiquidity(alice, poolKey, params, BalanceDelta.wrap(0));

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.liquidity, 1000 ether); // unchanged
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: Auto-Compound via afterSwap
    // ══════════════════════════════════════════════════════════════════════

    function test_AutoCompound_TriggersViaAfterSwap() public {
        // Set low minFeesRequired but non-zero minCompoundInterval
        // so fees accumulate on first swap but auto-compound only fires after time passes
        hook.updatePoolConfig(poolId, true, 10, 1, 10);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Simulate first large swap to accumulate fees
        _simulateSwap(true, 100 ether);

        // Fees should have accumulated (auto-compound won't fire yet because lastCompoundTime == block.timestamp)
        AutoCompoundHook.Position memory posAfterFirstSwap = hook.getPosition(positionId);
        assertTrue(posAfterFirstSwap.fees0Accumulated > 0, "Fees should accumulate after first swap");

        uint128 liquidityBefore = posAfterFirstSwap.liquidity;

        // Advance time past min compound interval
        vm.warp(block.timestamp + 11);

        // This swap should trigger auto-compound since fees > minFeesRequired and time has passed
        _simulateSwap(true, 1 ether);

        AutoCompoundHook.Position memory posAfterAutoCompound = hook.getPosition(positionId);

        // The position should have more liquidity than before auto-compound
        assertTrue(posAfterAutoCompound.liquidity > liquidityBefore, "Liquidity should have increased from auto-compound");

        // Total compounded should be non-zero
        assertTrue(hook.getTotalCompounded(poolId) > 0, "Should have recorded compounded amount");
    }

    function test_GetEstimatedCompound_AfterFeeAccumulation() public {
        // Use default config so auto-compound doesn't fire (minCompoundInterval=3600)
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        _simulateSwap(true, 100 ether);

        (uint256 fees0, uint256 fees1, uint128 estimatedLiquidity) = hook.getEstimatedCompound(positionId);

        uint256 expectedFees = (100 ether * 3000) / 1_000_000;
        assertEq(fees0, expectedFees);
        assertEq(fees1, 0);
        assertTrue(estimatedLiquidity > 0, "Estimated liquidity should be positive");
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW TESTS: Edge cases
    // ══════════════════════════════════════════════════════════════════════

    function test_NegativeDelta_FeesStillAccumulate() public {
        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        // Negative delta (output to user)
        _simulateSwap(true, -5 ether);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);

        // abs(-5 ether) = 5 ether, fee = 5 * 3000 / 1_000_000
        uint256 expectedFees = (5 ether * 3000) / 1_000_000;
        assertEq(position.fees0Accumulated, expectedFees);
    }

    function test_CompoundPosition_ResetsLastCompoundTime() public {
        // Use high minCompoundInterval so auto-compound doesn't fire during afterSwap
        hook.updatePoolConfig(poolId, true, 7200, 1, 10);

        uint256 positionId = _registerPositionWithLiquidity(alice, -600, 600, 1000 ether);

        _simulateSwap(true, 100 ether);

        uint256 compoundTime = block.timestamp + 7201;
        vm.warp(compoundTime);

        hook.compoundPosition(positionId);

        AutoCompoundHook.Position memory position = hook.getPosition(positionId);
        assertEq(position.lastCompoundTime, compoundTime);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TWAPOrderHook} from "../../src/hooks/TWAPOrderHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TWAPOrderHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    TWAPOrderHook public hook;

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
        hook = new TWAPOrderHook(address(poolManager));

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

        // Fund users with tokens
        token0.mint(alice, 100_000 ether);
        token1.mint(alice, 100_000 ether);
        token0.mint(bob, 100_000 ether);
        token1.mint(bob, 100_000 ether);

        // Approve hook to spend tokens
        vm.startPrank(alice);
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);
        vm.stopPrank();

        // Add liquidity to the pool so swaps can succeed
        poolManager.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -887220,
                tickUpper: 887220,
                liquidityDelta: int256(1_000_000 ether)
            })
        );
    }

    /// @notice Helper: mint output tokens to the hook to simulate PoolManager settlement
    /// Since the simplified PoolManager.swap() doesn't transfer tokens, the hook needs
    /// output tokens available for distribution after swap accounting.
    function _fundHookWithOutputTokens(bool zeroForOne, uint256 amount) internal {
        if (zeroForOne) {
            // Output token is token1
            token1.mint(address(hook), amount);
        } else {
            // Output token is token0
            token0.mint(address(hook), amount);
        }
    }

    function test_Constructor() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
        assertEq(hook.owner(), address(this));
        assertEq(hook.feeCollector(), address(this));
        assertEq(hook.nextOrderId(), 1);
    }

    function test_AfterInitialize() public {
        assertTrue(hook.isPoolInitialized(poolId));
    }

    function test_CreateTWAPOrder() public {
        uint256 aliceToken0Before = token0.balanceOf(alice);

        vm.startPrank(alice);

        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true, // zeroForOne
            1000 ether, // totalAmount
            10, // numberOfExecutions
            300, // executionInterval (5 min)
            0, // minAmountPerExecution (set to 0 for basic test)
            block.timestamp + 1 days // deadline
        );

        assertEq(orderId, 1);

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertEq(order.owner, alice);
        assertEq(order.totalAmount, 1000 ether);
        assertEq(order.numberOfExecutions, 10);
        assertEq(order.executionInterval, 300);
        assertTrue(order.status == TWAPOrderHook.OrderStatus.Active);

        // Verify tokens were transferred from alice to hook (escrow)
        uint256 aliceToken0After = token0.balanceOf(alice);
        assertEq(aliceToken0Before - aliceToken0After, 1000 ether);
        assertEq(token0.balanceOf(address(hook)), 1000 ether);

        vm.stopPrank();
    }

    function test_CreateTWAPOrder_RevertWhen_InvalidAmount() public {
        vm.expectRevert(TWAPOrderHook.InvalidAmount.selector);
        hook.createTWAPOrder(
            poolKey,
            true,
            0, // Invalid amount
            10,
            300,
            0,
            block.timestamp + 1 days
        );
    }

    function test_CreateTWAPOrder_RevertWhen_TooFewExecutions() public {
        vm.prank(alice);
        vm.expectRevert(TWAPOrderHook.InvalidNumberOfExecutions.selector);
        hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            1, // Too few
            300,
            0,
            block.timestamp + 1 days
        );
    }

    function test_CreateTWAPOrder_RevertWhen_IntervalTooShort() public {
        vm.prank(alice);
        vm.expectRevert(TWAPOrderHook.InvalidTimeWindow.selector);
        hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            30, // Too short
            0,
            block.timestamp + 1 days
        );
    }

    function test_ExecuteTWAPOrder() public {
        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0, // minAmountPerExecution (0 to allow any output)
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with output tokens to simulate PoolManager settlement
        // The swap will compute output amounts; the hook needs output tokens to distribute
        _fundHookWithOutputTokens(true, 1000 ether);

        // Wait for execution interval
        vm.warp(block.timestamp + 300);

        uint256 aliceToken1Before = token1.balanceOf(alice);

        (uint256 amountExecuted, uint256 amountReceived) = hook.executeTWAPOrder(orderId);

        assertEq(amountExecuted, 100 ether); // 1000 / 10
        assertGt(amountReceived, 0);

        // Verify alice received output tokens
        uint256 aliceToken1After = token1.balanceOf(alice);
        assertEq(aliceToken1After - aliceToken1Before, amountReceived);

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertEq(order.executedAmount, 100 ether);
    }

    function test_ExecuteTWAPOrder_RevertWhen_TooEarly() public {
        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0,
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Try to execute immediately
        vm.expectRevert(TWAPOrderHook.TooEarlyToExecute.selector);
        hook.executeTWAPOrder(orderId);
    }

    function test_ExecuteTWAPOrder_MultipleExecutions() public {
        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            5,
            300,
            0, // minAmountPerExecution
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with output tokens
        _fundHookWithOutputTokens(true, 10_000 ether);

        // Execute 3 times - need to advance time for each execution
        uint256 baseTime = block.timestamp;
        for (uint256 i = 0; i < 3; i++) {
            vm.warp(baseTime + (300 * (i + 1)));
            hook.executeTWAPOrder(orderId);
        }

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertEq(order.executedAmount, 600 ether); // 200 * 3
    }

    function test_ExecuteTWAPOrder_CompleteOrder() public {
        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            5,
            300,
            0, // minAmountPerExecution
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with output tokens
        _fundHookWithOutputTokens(true, 10_000 ether);

        // Execute all 5 times - need to advance time for each execution
        uint256 baseTime = block.timestamp;
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(baseTime + (300 * (i + 1)));
            hook.executeTWAPOrder(orderId);
        }

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertTrue(order.status == TWAPOrderHook.OrderStatus.Completed);
        assertEq(order.executedAmount, order.totalAmount);
    }

    function test_CancelTWAPOrder() public {
        uint256 aliceToken0Before = token0.balanceOf(alice);

        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0,
            block.timestamp + 1 days
        );

        // Verify tokens were escrowed
        assertEq(token0.balanceOf(alice), aliceToken0Before - 1000 ether);

        hook.cancelTWAPOrder(orderId);

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertTrue(order.status == TWAPOrderHook.OrderStatus.Cancelled);

        // Verify tokens were refunded back to alice
        assertEq(token0.balanceOf(alice), aliceToken0Before);

        vm.stopPrank();
    }

    function test_CancelTWAPOrder_RevertWhen_NotOwner() public {
        vm.prank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0,
            block.timestamp + 1 days
        );

        vm.prank(bob);
        vm.expectRevert(TWAPOrderHook.OrderNotOwned.selector);
        hook.cancelTWAPOrder(orderId);
    }

    function test_GetUserOrders() public {
        vm.startPrank(alice);

        hook.createTWAPOrder(poolKey, true, 1000 ether, 10, 300, 0, block.timestamp + 1 days);
        hook.createTWAPOrder(poolKey, false, 500 ether, 5, 600, 0, block.timestamp + 1 days);

        uint256[] memory userOrderIds = hook.getUserOrders(alice);
        assertEq(userOrderIds.length, 2);
        assertEq(userOrderIds[0], 1);
        assertEq(userOrderIds[1], 2);

        vm.stopPrank();
    }

    function test_IsReadyForExecution() public {
        vm.prank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0,
            block.timestamp + 1 days
        );

        // Not ready immediately
        assertFalse(hook.isReadyForExecution(orderId));

        // Ready after interval
        vm.warp(block.timestamp + 300);
        assertTrue(hook.isReadyForExecution(orderId));
    }

    function test_GetNextExecutionAmount() public {
        vm.prank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0,
            block.timestamp + 1 days
        );

        uint256 nextAmount = hook.getNextExecutionAmount(orderId);
        assertEq(nextAmount, 100 ether); // 1000 / 10
    }

    function test_GetOrderProgress() public {
        vm.prank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0, // minAmountPerExecution
            block.timestamp + 1 days
        );

        // Fund hook with output tokens
        _fundHookWithOutputTokens(true, 1000 ether);

        // Execute once
        vm.warp(block.timestamp + 300);
        hook.executeTWAPOrder(orderId);

        (
            uint256 executedAmount,
            uint256 totalAmount,
            uint256 percentComplete,
            uint256 executionsRemaining
        ) = hook.getOrderProgress(orderId);

        assertEq(executedAmount, 100 ether);
        assertEq(totalAmount, 1000 ether);
        assertEq(percentComplete, 1000); // 10%
        assertEq(executionsRemaining, 9);
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

    function test_ExecuteTWAPOrder_SlippageProtection() public {
        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            500 ether, // Very high minAmountPerExecution - should cause slippage revert
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with a small amount of output tokens
        _fundHookWithOutputTokens(true, 1000 ether);

        // Wait for execution interval
        vm.warp(block.timestamp + 300);

        // Should revert because the received amount is less than 500 ether per execution
        vm.expectRevert(TWAPOrderHook.SlippageExceeded.selector);
        hook.executeTWAPOrder(orderId);
    }

    function test_ExecuteTWAPOrder_FeeCollection() public {
        address feeCollectorAddr = hook.feeCollector();

        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0, // minAmountPerExecution
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with output tokens
        _fundHookWithOutputTokens(true, 1000 ether);

        uint256 feeCollectorToken1Before = token1.balanceOf(feeCollectorAddr);

        // Wait and execute
        vm.warp(block.timestamp + 300);
        (uint256 amountExecuted, uint256 amountReceived) = hook.executeTWAPOrder(orderId);

        uint256 feeCollectorToken1After = token1.balanceOf(feeCollectorAddr);
        uint256 feeCollected = feeCollectorToken1After - feeCollectorToken1Before;

        // Fee should be EXECUTION_FEE_BPS (10 bps) of gross amount
        // amountReceived = grossAmount - fee, so grossAmount = amountReceived + feeCollected
        uint256 grossAmount = amountReceived + feeCollected;
        assertEq(feeCollected, (grossAmount * 10) / 10000);
        assertGt(feeCollected, 0);
    }

    function test_CancelTWAPOrder_PartialExecution() public {
        uint256 aliceToken0Before = token0.balanceOf(alice);

        vm.startPrank(alice);
        uint256 orderId = hook.createTWAPOrder(
            poolKey,
            true,
            1000 ether,
            10,
            300,
            0, // minAmountPerExecution
            block.timestamp + 1 days
        );
        vm.stopPrank();

        // Fund hook with output tokens for the execution
        _fundHookWithOutputTokens(true, 1000 ether);

        // Execute once (100 ether)
        vm.warp(block.timestamp + 300);
        hook.executeTWAPOrder(orderId);

        // Now cancel - should refund remaining 900 ether
        vm.prank(alice);
        hook.cancelTWAPOrder(orderId);

        // Check that alice got the remaining 900 ether back
        uint256 aliceToken0After = token0.balanceOf(alice);
        // Alice started with aliceToken0Before, escrowed 1000, got 900 back
        assertEq(aliceToken0After, aliceToken0Before - 100 ether);

        TWAPOrderHook.TWAPOrder memory order = hook.getOrder(orderId);
        assertTrue(order.status == TWAPOrderHook.OrderStatus.Cancelled);
        assertEq(order.executedAmount, 100 ether);
    }
}

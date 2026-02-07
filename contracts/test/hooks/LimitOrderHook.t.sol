// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {LimitOrderHook} from "../../src/hooks/LimitOrderHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {FullMath} from "../../src/libraries/FullMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LimitOrderHookTest
/// @notice Tests for LimitOrderHook contract
contract LimitOrderHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    LimitOrderHook public hook;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;
    bytes32 public poolId;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function setUp() public {
        // Deploy contracts
        poolManager = new PoolManager();
        hook = new LimitOrderHook(address(poolManager));

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

        // Fund users
        token0.mint(alice, 10000 ether);
        token1.mint(alice, 10000 ether);
        token0.mint(bob, 10000 ether);
        token1.mint(bob, 10000 ether);

        // Approve hook to spend tokens (for limit orders)
        vm.startPrank(alice);
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);
        vm.stopPrank();
    }

    // ══════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constructor() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
        assertEq(hook.feeCollector(), address(this));
        assertEq(hook.executionFee(), 30);
    }

    function test_GetHookPermissions() public view {
        LimitOrderHook.Permissions memory permissions = hook.getHookPermissions();

        assertEq(permissions.beforeInitialize, false);
        assertEq(permissions.afterInitialize, true);
        assertEq(permissions.beforeModifyLiquidity, false);
        assertEq(permissions.afterModifyLiquidity, false);
        assertEq(permissions.beforeSwap, true);
        assertEq(permissions.afterSwap, true);
    }

    function test_AfterInitialize() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        assertTrue(hook.isPoolInitialized(poolId));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORDER PLACEMENT TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_PlaceOrder() public {
        // Initialize hook
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place order
        vm.startPrank(alice);
        uint256 orderId = hook.placeOrder(
            poolKey,
            true, // zeroForOne
            60, // tick
            1 ether, // amountIn
            0.9 ether, // amountOutMinimum
            uint32(block.timestamp + 1 hours) // deadline
        );
        vm.stopPrank();

        // Verify order
        assertEq(orderId, 0);

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(order.owner, alice);
        assertEq(order.poolId, poolId);
        assertTrue(order.zeroForOne);
        assertEq(order.tick, 60);
        assertEq(order.amountIn, 1 ether);
        assertEq(order.amountOutMinimum, 0.9 ether);
        assertEq(order.amountFilled, 0);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));
    }

    function test_PlaceOrder_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(LimitOrderHook.PoolNotInitialized.selector);
        hook.placeOrder(uninitializedKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
    }

    function test_PlaceOrder_RevertWhen_ZeroAmount() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.expectRevert(LimitOrderHook.InvalidAmount.selector);
        hook.placeOrder(poolKey, true, 60, 0, 0.9 ether, uint32(block.timestamp + 1 hours));
    }

    function test_PlaceOrder_RevertWhen_InvalidTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.expectRevert(LimitOrderHook.InvalidTick.selector);
        hook.placeOrder(poolKey, true, 1000000, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
    }

    function test_PlaceOrder_RevertWhen_DeadlineExpired() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.expectRevert(LimitOrderHook.InvalidAmount.selector);
        hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp - 1));
    }

    function test_PlaceOrder_MultipleOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        uint256 orderId1 = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
        uint256 orderId2 = hook.placeOrder(poolKey, false, 120, 2 ether, 1.8 ether, uint32(block.timestamp + 2 hours));
        vm.stopPrank();

        assertEq(orderId1, 0);
        assertEq(orderId2, 1);

        uint256[] memory userOrders = hook.getUserOrders(alice);
        assertEq(userOrders.length, 2);
        assertEq(userOrders[0], 0);
        assertEq(userOrders[1], 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORDER CANCELLATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_CancelOrder() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        hook.cancelOrder(orderId);
        vm.stopPrank();

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Cancelled));
    }

    function test_CancelOrder_RevertWhen_NotOwner() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        vm.prank(bob);
        vm.expectRevert(LimitOrderHook.Unauthorized.selector);
        hook.cancelOrder(orderId);
    }

    function test_CancelOrder_RevertWhen_OrderNotFound() public {
        vm.expectRevert(LimitOrderHook.OrderNotFound.selector);
        hook.cancelOrder(999);
    }

    function test_CancelOrder_RevertWhen_AlreadyCancelled() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        hook.cancelOrder(orderId);

        vm.expectRevert(LimitOrderHook.OrderAlreadyCancelled.selector);
        hook.cancelOrder(orderId);
        vm.stopPrank();
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORDER CLAIM TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_ClaimOrder_RevertWhen_NotOwner() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        vm.prank(bob);
        vm.expectRevert(LimitOrderHook.Unauthorized.selector);
        hook.claimOrder(orderId);
    }

    function test_ClaimOrder_RevertWhen_OrderNotFound() public {
        vm.expectRevert(LimitOrderHook.OrderNotFound.selector);
        hook.claimOrder(999);
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK EXECUTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_BeforeSwap() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        bytes4 selector = hook.beforeSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0));

        assertEq(selector, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(LimitOrderHook.PoolNotInitialized.selector);
        hook.beforeSwap(address(this), uninitializedKey, IPoolManager.SwapParams(true, 1e18, 0));
    }

    function test_AfterSwap() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(address(poolManager));
        bytes4 selector =
            hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));

        assertEq(selector, IHooks.afterSwap.selector);
    }

    function test_AfterSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(LimitOrderHook.PoolNotInitialized.selector);
        hook.afterSwap(address(this), uninitializedKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_GetOrder() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        LimitOrderHook.Order memory order = hook.getOrder(orderId);

        assertEq(order.owner, alice);
        assertEq(order.tick, 60);
        assertEq(order.amountIn, 1 ether);
    }

    function test_GetUserOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
        hook.placeOrder(poolKey, false, 120, 2 ether, 1.8 ether, uint32(block.timestamp + 2 hours));
        vm.stopPrank();

        uint256[] memory userOrders = hook.getUserOrders(alice);

        assertEq(userOrders.length, 2);
    }

    function test_GetPoolTickOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
        hook.placeOrder(poolKey, true, 60, 2 ether, 1.8 ether, uint32(block.timestamp + 1 hours));
        vm.stopPrank();

        uint256[] memory tickOrders = hook.getPoolTickOrders(poolId, 60);

        assertEq(tickOrders.length, 2);
    }

    function test_GetClaimable() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        LimitOrderHook.ClaimableAmount memory claimAmount = hook.getClaimable(orderId);

        // Initially should be zero
        assertEq(claimAmount.amount0, 0);
        assertEq(claimAmount.amount1, 0);
    }

    function test_IsFillable_ZeroForOne_AtTargetTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a zeroForOne order at tick 0 (current tick)
        // zeroForOne orders are fillable when currentTick <= order.tick
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Pool is at tick 0, order is at tick 0 => currentTick <= order.tick => fillable
        assertTrue(hook.isFillable(orderId));
    }

    function test_IsFillable_ZeroForOne_AboveTargetTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a zeroForOne order at tick -60 (below current tick 0)
        // zeroForOne orders are fillable when currentTick <= order.tick
        // currentTick (0) > order.tick (-60) => NOT fillable
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, -60, 1 ether, 0, uint32(block.timestamp + 1 hours));

        assertFalse(hook.isFillable(orderId));
    }

    function test_IsFillable_OneForZero_AtTargetTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a oneForZero order at tick 0 (current tick)
        // oneForZero orders are fillable when currentTick >= order.tick
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, false, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Pool is at tick 0, order is at tick 0 => currentTick >= order.tick => fillable
        assertTrue(hook.isFillable(orderId));
    }

    function test_IsFillable_OneForZero_BelowTargetTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a oneForZero order at tick 60 (above current tick 0)
        // oneForZero orders are fillable when currentTick >= order.tick
        // currentTick (0) < order.tick (60) => NOT fillable
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, false, 60, 1 ether, 0, uint32(block.timestamp + 1 hours));

        assertFalse(hook.isFillable(orderId));
    }

    function test_IsFillable_ReturnsFalse_WhenCancelled() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.startPrank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));
        hook.cancelOrder(orderId);
        vm.stopPrank();

        assertFalse(hook.isFillable(orderId));
    }

    function test_IsFillable_ReturnsFalse_WhenExpired() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 100));

        // Warp past deadline
        vm.warp(block.timestamp + 200);

        assertFalse(hook.isFillable(orderId));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_SetExecutionFee() public {
        uint24 newFee = 50;

        hook.setExecutionFee(newFee);

        assertEq(hook.executionFee(), newFee);
    }

    function test_SetExecutionFee_RevertWhen_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook.setExecutionFee(50);
    }

    function test_SetExecutionFee_RevertWhen_TooHigh() public {
        vm.expectRevert(LimitOrderHook.InvalidAmount.selector);
        hook.setExecutionFee(1001); // > 10%
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
        vm.expectRevert(LimitOrderHook.InvalidAmount.selector);
        hook.setFeeCollector(address(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // BOUNDED ARRAY / GAS DoS PROTECTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constants_MaxOrdersPerTick() public view {
        assertEq(hook.MAX_ORDERS_PER_TICK(), 200);
    }

    function test_TickOrderLimit_Enforced() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 deadline = uint32(block.timestamp + 1 hours);

        // Fill up to MAX_ORDERS_PER_TICK
        for (uint256 i = 0; i < hook.MAX_ORDERS_PER_TICK(); i++) {
            address user = address(uint160(0x2000 + i));
            token0.mint(user, 1 ether);
            vm.startPrank(user);
            token0.approve(address(hook), type(uint256).max);
            hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
            vm.stopPrank();
        }

        // Verify count
        assertEq(hook.getTickOrderCount(poolId, tick), hook.MAX_ORDERS_PER_TICK());

        // Next order at same tick should revert
        address extraUser = address(uint160(0x2000 + hook.MAX_ORDERS_PER_TICK()));
        token0.mint(extraUser, 1 ether);
        vm.startPrank(extraUser);
        token0.approve(address(hook), type(uint256).max);
        vm.expectRevert(LimitOrderHook.TickOrderLimitReached.selector);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
        vm.stopPrank();
    }

    function test_TickOrderLimit_DifferentTicksIndependent() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint32 deadline = uint32(block.timestamp + 1 hours);

        // Place order at tick 60
        vm.prank(alice);
        hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, deadline);

        // Place order at tick 120 (different tick, independent limit)
        vm.prank(alice);
        hook.placeOrder(poolKey, false, 120, 1 ether, 0.9 ether, deadline);

        assertEq(hook.getTickOrderCount(poolId, 60), 1);
        assertEq(hook.getTickOrderCount(poolId, 120), 1);
    }

    function test_CleanupTickOrders_RemovesCancelledAndExpired() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 deadline = uint32(block.timestamp + 1 hours);

        // Alice places 3 orders at tick 60
        vm.startPrank(alice);
        uint256 order0 = hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
        uint256 order1 = hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
        uint256 order2 = hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);

        // Cancel order1
        hook.cancelOrder(order1);
        vm.stopPrank();

        assertEq(hook.getTickOrderCount(poolId, tick), 3);

        // Cleanup should remove the cancelled order
        uint256 removed = hook.cleanupTickOrders(poolId, tick);
        assertEq(removed, 1);
        assertEq(hook.getTickOrderCount(poolId, tick), 2);
    }

    function test_CleanupTickOrders_RemovesExpiredOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 shortDeadline = uint32(block.timestamp + 100);

        // Place orders with short deadline
        vm.startPrank(alice);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, shortDeadline);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, shortDeadline);
        vm.stopPrank();

        assertEq(hook.getTickOrderCount(poolId, tick), 2);

        // Warp past deadline
        vm.warp(block.timestamp + 200);

        // Cleanup should remove expired orders
        uint256 removed = hook.cleanupTickOrders(poolId, tick);
        assertEq(removed, 2);
        assertEq(hook.getTickOrderCount(poolId, tick), 0);
    }

    function test_CleanupTickOrders_KeepsOpenOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 deadline = uint32(block.timestamp + 1 hours);

        // Place open orders
        vm.startPrank(alice);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);
        vm.stopPrank();

        // Cleanup should not remove open orders
        uint256 removed = hook.cleanupTickOrders(poolId, tick);
        assertEq(removed, 0);
        assertEq(hook.getTickOrderCount(poolId, tick), 2);
    }

    function test_CleanupTickOrders_FreesSlots() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 shortDeadline = uint32(block.timestamp + 100);
        uint32 longDeadline = uint32(block.timestamp + 1 hours);

        // Fill most slots with soon-to-expire orders
        for (uint256 i = 0; i < hook.MAX_ORDERS_PER_TICK() - 1; i++) {
            address user = address(uint160(0x3000 + i));
            token0.mint(user, 1 ether);
            vm.startPrank(user);
            token0.approve(address(hook), type(uint256).max);
            hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, shortDeadline);
            vm.stopPrank();
        }

        // Place one more order (reaching limit)
        vm.prank(alice);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, longDeadline);

        assertEq(hook.getTickOrderCount(poolId, tick), hook.MAX_ORDERS_PER_TICK());

        // Warp past the short deadline
        vm.warp(block.timestamp + 200);

        // Cleanup expired orders
        uint256 removed = hook.cleanupTickOrders(poolId, tick);
        assertEq(removed, hook.MAX_ORDERS_PER_TICK() - 1);
        assertEq(hook.getTickOrderCount(poolId, tick), 1);

        // Now we can place new orders again
        address newUser = address(uint160(0x9999));
        token0.mint(newUser, 1 ether);
        vm.startPrank(newUser);
        token0.approve(address(hook), type(uint256).max);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, longDeadline);
        vm.stopPrank();

        assertEq(hook.getTickOrderCount(poolId, tick), 2);
    }

    function test_GetTickOrderCount() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 tick = 60;
        uint32 deadline = uint32(block.timestamp + 1 hours);

        // Initially zero
        assertEq(hook.getTickOrderCount(poolId, tick), 0);

        vm.prank(alice);
        hook.placeOrder(poolKey, true, tick, 1 ether, 0.9 ether, deadline);

        assertEq(hook.getTickOrderCount(poolId, tick), 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTEGRATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_FullOrderLifecycle() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // 1. Alice places order
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));

        // 2. Check order is open
        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));

        // 3. Alice cancels order
        vm.prank(alice);
        hook.cancelOrder(orderId);

        // 4. Check order is cancelled
        order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Cancelled));
    }

    function test_MultipleUsersOrders() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Alice places 2 orders
        vm.startPrank(alice);
        hook.placeOrder(poolKey, true, 60, 1 ether, 0.9 ether, uint32(block.timestamp + 1 hours));
        hook.placeOrder(poolKey, false, 120, 2 ether, 1.8 ether, uint32(block.timestamp + 1 hours));
        vm.stopPrank();

        // Bob places 1 order
        vm.prank(bob);
        hook.placeOrder(poolKey, true, 60, 3 ether, 2.7 ether, uint32(block.timestamp + 1 hours));

        // Check user orders
        assertEq(hook.getUserOrders(alice).length, 2);
        assertEq(hook.getUserOrders(bob).length, 1);

        // Check tick orders
        uint256[] memory tick60Orders = hook.getPoolTickOrders(poolId, 60);
        assertEq(tick60Orders.length, 2); // Alice and Bob both have orders at tick 60
    }

    // ══════════════════════════════════════════════════════════════════════
    // PRICE CALCULATION ACCURACY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_PriceCalculation_AtTick0_1to1() public {
        // At tick 0, sqrtPriceX96 = 2^96, so price = 1.0
        // Converting 1 token0 should give ~1 token1
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a zeroForOne order at tick 0 with zero minimum
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Simulate fill via afterSwap (the pool is at tick 0, order is at tick 0)
        // We need to call afterSwap with a swapDirection opposite to the order (oneForZero)
        // The current tick must be at order tick for the order to be in poolTickOrders
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        // The order should be filled since currentTick(0) <= order.tick(0) and direction matches
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        // Check that claimable amount is reasonable (close to 1 ether minus fee)
        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        // At 1:1 price with 0.3% fee: ~0.997 ether expected
        // Allow some tolerance for rounding
        assertTrue(claim.amount1 > 0.99 ether, "Output should be close to 1 ether at 1:1 price");
        assertTrue(claim.amount1 <= 1 ether, "Output should not exceed input at 1:1 price");
    }

    function test_PriceCalculation_PositiveTick_ZeroForOne() public {
        // At positive tick, price > 1 (token1/token0)
        // Selling 1 token0 at tick 1000 should give > 1 token1
        //
        // Orders are stored in poolTickOrders[poolId][orderTick].
        // The afterSwap hook checks orders at the *current* pool tick.
        // So for this order to be found and filled, the pool's current tick must be
        // at the order's tick (1000) when afterSwap is called.
        //
        // We initialize the pool at a sqrt price corresponding to tick 1000.
        uint160 sqrtPriceAtTick1000 = TickMath.getSqrtPriceAtTick(1000);
        PoolKey memory key1000 = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(address(0))
        });
        poolManager.initialize(key1000, sqrtPriceAtTick1000);

        bytes32 poolId1000 = keccak256(abi.encode(key1000));
        hook.afterInitialize(address(this), key1000, sqrtPriceAtTick1000, 1000);

        int24 orderTick = 1000;

        vm.prank(alice);
        uint256 orderId =
            hook.placeOrder(key1000, true, orderTick, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill via afterSwap with oneForZero swap direction (opposite to order)
        // Pool is at tick 1000, and we look up poolTickOrders[poolId][1000] which contains this order.
        // For zeroForOne order: canFill requires swapDirection != order.zeroForOne and currentTick <= orderTick
        // swapDirection is false (oneForZero), order.zeroForOne is true => different => OK
        // currentTick(1000) <= orderTick(1000) => OK
        hook.afterSwap(
            address(this),
            key1000,
            IPoolManager.SwapParams(false, 1e18, sqrtPriceAtTick1000),
            BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        // Claimable amount should be > 1 ether (since price > 1 at tick 1000)
        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        assertTrue(claim.amount1 > 1 ether, "At positive tick, output should exceed input");
    }

    function test_PriceCalculation_NegativeTick_ZeroForOne() public {
        // At negative tick, token1 is worth less per token0 (price < 1)
        // So selling 1 token0 should give < 1 token1
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        int24 orderTick = -1000; // price ~= 1.0001^(-1000) ~= 0.9048

        vm.prank(alice);
        uint256 orderId =
            hook.placeOrder(poolKey, true, orderTick, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill (pool at tick 0, order at -1000; for zeroForOne, need currentTick <= orderTick)
        // Pool tick 0 > -1000, so this order won't fill via afterSwap at current tick
        hook.afterSwap(
            address(this),
            poolKey,
            IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1),
            BalanceDelta.wrap(0)
        );

        // Order should NOT be filled since currentTick(0) > orderTick(-1000) for zeroForOne
        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));
    }

    function test_PriceCalculation_OneForZero_PositiveTick() public {
        // oneForZero order at tick 0: selling token1 for token0
        // At tick 0, price = 1, so output should be ~1
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, false, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill via afterSwap with zeroForOne swap (opposite direction)
        // For oneForZero order, fillable when currentTick >= order.tick
        // currentTick(0) >= 0, so it should fill
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(true, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        // Check output is close to 1 ether (at 1:1 price minus fee)
        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        assertTrue(claim.amount0 > 0.99 ether, "Output should be close to 1 ether at 1:1 price");
        assertTrue(claim.amount0 <= 1 ether, "Output should not exceed input at 1:1 price");
    }

    // ══════════════════════════════════════════════════════════════════════
    // EDGE CASE TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_PriceCalculation_VerySmallAmount() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place order with very small amount (1 wei)
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        // Should either fill with 0 or 1 wei output (rounding), or skip if 0
        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        // Just verify it doesn't revert
        assertTrue(
            uint8(order.status) == uint8(LimitOrderHook.OrderStatus.Filled)
                || uint8(order.status) == uint8(LimitOrderHook.OrderStatus.Open)
        );
    }

    function test_PriceCalculation_LargeAmount() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place order with large amount
        uint128 largeAmount = 1000 ether;
        token0.mint(alice, largeAmount);
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, largeAmount, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        // Output should be reasonable (close to 1000 ether minus fee at 1:1 price)
        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        assertTrue(claim.amount1 > 990 ether, "Large amount output should be close to input at 1:1 price");
    }

    function test_PriceCalculation_NearMinTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place order near MIN_TICK
        int24 nearMinTick = TickMath.MIN_TICK + 1;

        vm.prank(alice);
        // This should not revert - order is placed but won't fill since
        // currentTick (0) > nearMinTick for zeroForOne
        uint256 orderId =
            hook.placeOrder(poolKey, true, nearMinTick, 1 ether, 0, uint32(block.timestamp + 1 hours));

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));
    }

    function test_PriceCalculation_NearMaxTick() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place oneForZero order near MAX_TICK
        int24 nearMaxTick = TickMath.MAX_TICK - 1;

        vm.prank(alice);
        // oneForZero at near max tick: won't fill since currentTick(0) < nearMaxTick
        uint256 orderId =
            hook.placeOrder(poolKey, false, nearMaxTick, 1 ether, 0, uint32(block.timestamp + 1 hours));

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));

        // Verify isFillable returns false
        assertFalse(hook.isFillable(orderId));
    }

    function test_OrderNotFilled_WhenSwapDirectionMatchesOrderDirection() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Place a zeroForOne order at tick 0
        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Try to fill with a zeroForOne swap (SAME direction as order)
        // This should NOT fill the order
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(true, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Open));
    }

    function test_OrderExpired_DuringExecution() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(alice);
        uint256 orderId =
            hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 100));

        // Warp past deadline
        vm.warp(block.timestamp + 200);

        // Try to fill -- should mark as expired instead
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Expired));
    }

    function test_ExecutionFee_DeductedCorrectly() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Set execution fee to 100 bps (1%)
        hook.setExecutionFee(100);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Trigger fill
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        // At 1:1 price, gross output ~1 ether, 1% fee => net ~0.99 ether
        assertTrue(claim.amount1 > 0.98 ether, "After 1% fee, output should be close to 0.99 ether");
        assertTrue(claim.amount1 < 1 ether, "Fee should be deducted from output");
    }

    function test_ZeroFee_NoDeduction() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Set fee to 0
        hook.setExecutionFee(0);

        vm.prank(alice);
        uint256 orderId = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.Order memory order = hook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LimitOrderHook.OrderStatus.Filled));

        // With 0 fee and 1:1 price, output should be ~1 ether
        LimitOrderHook.ClaimableAmount memory claim = hook.getClaimable(orderId);
        assertTrue(claim.amount1 > 0.999 ether, "With zero fee, output should equal input at 1:1 price");
    }

    function test_PriceConversion_Symmetry() public {
        // Verify that selling token0 for token1 at tick 0 gives similar output
        // as selling token1 for token0 at tick 0 (both should be ~1:1)
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Set fee to 0 for clean comparison
        hook.setExecutionFee(0);

        // zeroForOne order
        vm.prank(alice);
        uint256 orderId0 = hook.placeOrder(poolKey, true, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // oneForZero order
        vm.prank(bob);
        uint256 orderId1 = hook.placeOrder(poolKey, false, 0, 1 ether, 0, uint32(block.timestamp + 1 hours));

        // Fill zeroForOne order (with oneForZero swap)
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(false, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        // Fill oneForZero order (with zeroForOne swap)
        hook.afterSwap(
            address(this), poolKey, IPoolManager.SwapParams(true, 1e18, SQRT_PRICE_1_1), BalanceDelta.wrap(0)
        );

        LimitOrderHook.ClaimableAmount memory claim0 = hook.getClaimable(orderId0);
        LimitOrderHook.ClaimableAmount memory claim1 = hook.getClaimable(orderId1);

        // At tick 0, both should produce ~1 ether output
        assertTrue(claim0.amount1 > 0.99 ether, "zeroForOne output at tick 0 should be ~1 ether");
        assertTrue(claim1.amount0 > 0.99 ether, "oneForZero output at tick 0 should be ~1 ether");

        // The difference between the two should be very small (< 0.01 ether)
        uint256 diff = claim0.amount1 > claim1.amount0
            ? claim0.amount1 - claim1.amount0
            : claim1.amount0 - claim0.amount1;
        assertTrue(diff < 0.01 ether, "Outputs should be symmetric at tick 0");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {DynamicFeeHook} from "../../src/hooks/DynamicFeeHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DynamicFeeHookTest
/// @notice Tests for DynamicFeeHook contract
contract DynamicFeeHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    DynamicFeeHook public hook;

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
        hook = new DynamicFeeHook(address(poolManager));

        // Deploy tokens
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        // Note: In production, hook address would need special permissions
        // For testing, we use address(0) for hooks
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
        assertEq(hook.owner(), address(this));
    }

    function test_GetHookPermissions() public view {
        DynamicFeeHook.Permissions memory permissions = hook.getHookPermissions();

        assertEq(permissions.beforeInitialize, false);
        assertEq(permissions.afterInitialize, true);
        assertEq(permissions.beforeModifyLiquidity, false);
        assertEq(permissions.afterModifyLiquidity, false);
        assertEq(permissions.beforeSwap, true);
        assertEq(permissions.afterSwap, true);
    }

    function test_AfterInitialize() public {
        // Simulate afterInitialize call
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Check initialization
        assertTrue(hook.isPoolInitialized(poolId));
        assertEq(hook.currentFee(poolId), hook.BASE_FEE());
        assertEq(hook.sampleCount(poolId), 1);
        assertEq(hook.currentIndex(poolId), 0);

        // Check first price sample
        (uint160[10] memory prices) = hook.getPriceHistory(poolId);
        assertEq(prices[0], SQRT_PRICE_1_1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // VOLATILITY CALCULATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_VolatilityCalculation_LowVolatility() public {
        // Initialize
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Simulate multiple swaps with low price changes
        uint160[] memory prices = new uint160[](5);
        prices[0] = SQRT_PRICE_1_1;
        prices[1] = SQRT_PRICE_1_1 + 1e15; // ~0.001% change
        prices[2] = SQRT_PRICE_1_1 + 2e15;
        prices[3] = SQRT_PRICE_1_1 + 3e15;
        prices[4] = SQRT_PRICE_1_1 + 4e15;

        // Simulate swaps (we need to update pool state first)
        for (uint256 i = 1; i < prices.length; i++) {
            vm.warp(block.timestamp + 60); // Move time forward

            // Manually record price (simulating afterSwap)
            // In reality, this would be called by PoolManager
            vm.prank(address(poolManager));
            hook.afterSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
        }

        // Check that volatility is low
        uint256 volatility = hook.getVolatility(poolId);
        console2.log("Low Volatility:", volatility);

        // Fee should be at minimum
        assertEq(hook.currentFee(poolId), hook.MIN_FEE());
    }

    function test_GetFee() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint24 fee = hook.getFee(poolId);
        assertEq(fee, hook.BASE_FEE());
    }

    function test_GetVolatility_InsufficientSamples() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // With only 1 sample, volatility should be 0
        uint256 volatility = hook.getVolatility(poolId);
        assertEq(volatility, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK EXECUTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_BeforeSwap() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Should return correct selector
        bytes4 selector = hook.beforeSwap(address(this), poolKey, IPoolManager.SwapParams(true, 1e18, 0));

        assertEq(selector, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        vm.expectRevert(DynamicFeeHook.PoolNotInitialized.selector);
        hook.beforeSwap(address(this), uninitializedKey, IPoolManager.SwapParams(true, 1e18, 0));
    }

    function test_AfterSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        vm.expectRevert(DynamicFeeHook.PoolNotInitialized.selector);
        hook.afterSwap(address(this), uninitializedKey, IPoolManager.SwapParams(true, 1e18, 0), BalanceDelta.wrap(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_TransferOwnership_TwoStep() public {
        address newOwner = makeAddr("newOwner");

        // Step 1: Propose transfer (owner doesn't change yet)
        hook.transferOwnership(newOwner);
        assertEq(hook.pendingOwner(), newOwner);
        assertEq(hook.owner(), address(this));

        // Step 2: New owner accepts
        vm.prank(newOwner);
        hook.acceptOwnership();
        assertEq(hook.owner(), newOwner);
        assertEq(hook.pendingOwner(), address(0));
    }

    function test_TransferOwnership_RevertWhen_Unauthorized() public {
        address newOwner = makeAddr("newOwner");
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.transferOwnership(newOwner);
    }

    function test_AcceptOwnership_RevertWhen_WrongAcceptor() public {
        address newOwner = makeAddr("newOwner");
        address attacker = makeAddr("attacker");

        hook.transferOwnership(newOwner);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.acceptOwnership();
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_GetPriceHistory() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint160[10] memory prices = hook.getPriceHistory(poolId);

        assertEq(prices[0], SQRT_PRICE_1_1);

        // Rest should be 0
        for (uint256 i = 1; i < 10; i++) {
            assertEq(prices[i], 0);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constants() public view {
        assertEq(hook.MIN_FEE(), 100); // 0.01%
        assertEq(hook.MAX_FEE(), 10000); // 1%
        assertEq(hook.BASE_FEE(), 3000); // 0.3%
        assertEq(hook.SAMPLE_SIZE(), 10);
    }
}

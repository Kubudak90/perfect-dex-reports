// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {SwapRouter} from "../../src/core/SwapRouter.sol";
import {Quoter} from "../../src/core/Quoter.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SwapRouterTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    SwapRouter public swapRouter;
    Quoter public quoter;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Permit2 address (canonical deployment)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Constants
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 constant FEE_TIER = 3000; // 0.3%
    int24 constant TICK_SPACING = 60;

    function setUp() public {
        // Deploy contracts
        poolManager = new PoolManager();
        swapRouter = new SwapRouter(address(poolManager), PERMIT2);
        quoter = new Quoter(address(poolManager));

        // Deploy mock tokens
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        // Ensure proper sorting
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        // Setup accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Mint tokens
        token0.mint(alice, 1000000 ether);
        token1.mint(alice, 1000000 ether);
        token0.mint(bob, 1000000 ether);
        token1.mint(bob, 1000000 ether);

        // Initialize pool
        PoolKey memory poolKey = _createPoolKey();
        poolManager.initialize(poolKey, SQRT_PRICE_1_1);

        // Add liquidity (simplified - in production use PositionManager)
        // TODO: Week 3 - Use PositionManager for proper liquidity addition
    }

    // ══════════════════════════════════════════════════════════════════════
    // SWAP TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_ExactInputSingle_RevertWhen_ZeroAmount() public {
        PoolKey memory poolKey = _createPoolKey();

        SwapRouter.ExactInputSingleParams memory params = SwapRouter.ExactInputSingleParams({
            poolKey: poolKey,
            zeroForOne: true,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            recipient: alice,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        vm.expectRevert(SwapRouter.ZeroAmount.selector);
        swapRouter.exactInputSingle(params);
    }

    function test_ExactInputSingle_RevertWhen_DeadlineExpired() public {
        PoolKey memory poolKey = _createPoolKey();

        SwapRouter.ExactInputSingleParams memory params = SwapRouter.ExactInputSingleParams({
            poolKey: poolKey,
            zeroForOne: true,
            amountIn: 1 ether,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            recipient: alice,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(alice);
        vm.expectRevert(SwapRouter.DeadlineExpired.selector);
        swapRouter.exactInputSingle(params);
    }

    // ══════════════════════════════════════════════════════════════════════
    // QUOTER TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_GetPoolPrice() public view {
        PoolKey memory poolKey = _createPoolKey();
        (uint160 sqrtPriceX96, int24 tick, uint128 liquidity) = quoter.getPoolPrice(poolKey);

        assertEq(sqrtPriceX96, SQRT_PRICE_1_1, "Sqrt price should match");
        assertEq(liquidity, 0, "Liquidity should be 0 (no LP added yet)");
    }

    function test_GetPrice() public view {
        PoolKey memory poolKey = _createPoolKey();
        uint256 price = quoter.getPrice(poolKey);

        // Price should be ~1e18 (1:1 ratio)
        assertGt(price, 0, "Price should be greater than 0");
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAUSE TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksExactInputSingle() public {
        PoolKey memory poolKey = _createPoolKey();

        // Pause the router
        swapRouter.pause();

        SwapRouter.ExactInputSingleParams memory params = SwapRouter.ExactInputSingleParams({
            poolKey: poolKey,
            zeroForOne: true,
            amountIn: 1 ether,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            recipient: alice,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        swapRouter.exactInputSingle(params);
    }

    function test_Pause_OnlyOwner() public {
        // Non-owner tries to pause - should revert
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        swapRouter.pause();
    }

    function test_Unpause_AllowsSwap() public {
        // Pause and then unpause
        swapRouter.pause();
        swapRouter.unpause();

        // After unpause, a swap call should not revert with EnforcedPause
        // (it may revert for other reasons like ZeroAmount, but not EnforcedPause)
        PoolKey memory poolKey = _createPoolKey();

        SwapRouter.ExactInputSingleParams memory params = SwapRouter.ExactInputSingleParams({
            poolKey: poolKey,
            zeroForOne: true,
            amountIn: 0, // Will revert with ZeroAmount, not EnforcedPause
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            recipient: alice,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        vm.expectRevert(SwapRouter.ZeroAmount.selector);
        swapRouter.exactInputSingle(params);
    }

    function test_Unpause_OnlyOwner() public {
        // Pause first
        swapRouter.pause();

        // Non-owner tries to unpause - should revert
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        swapRouter.unpause();
    }

    // ══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    function _createPoolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE_TIER,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }
}

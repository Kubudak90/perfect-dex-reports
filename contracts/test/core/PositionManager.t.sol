// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {PositionManager} from "../../src/core/PositionManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract PositionManagerTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    PositionManager public positionManager;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Constants
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 constant FEE_TIER = 3000; // 0.3%
    int24 constant TICK_SPACING = 60;

    function setUp() public {
        // Deploy contracts
        poolManager = new PoolManager();
        positionManager = new PositionManager(address(poolManager));

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
    }

    // ══════════════════════════════════════════════════════════════════════
    // MINT TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Mint() public {
        PoolKey memory poolKey = _createPoolKey();

        PositionManager.MintParams memory params = PositionManager.MintParams({
            poolKey: poolKey,
            tickLower: -600,
            tickUpper: 600,
            amount0Desired: 1000 ether,
            amount1Desired: 1000 ether,
            amount0Min: 900 ether,
            amount1Min: 900 ether,
            recipient: alice,
            deadline: block.timestamp + 1 hours
        });

        // Approve tokens
        vm.startPrank(alice);
        token0.approve(address(positionManager), type(uint256).max);
        token1.approve(address(positionManager), type(uint256).max);

        // Mint position
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.mint(params);

        // Assertions
        assertEq(positionManager.ownerOf(tokenId), alice, "Alice should own the NFT");
        assertGt(liquidity, 0, "Liquidity should be greater than 0");
        assertEq(amount0, 1000 ether, "Amount0 should match");
        assertEq(amount1, 1000 ether, "Amount1 should match");

        vm.stopPrank();
    }

    function test_Mint_RevertWhen_DeadlineExpired() public {
        PoolKey memory poolKey = _createPoolKey();

        PositionManager.MintParams memory params = PositionManager.MintParams({
            poolKey: poolKey,
            tickLower: -600,
            tickUpper: 600,
            amount0Desired: 1000 ether,
            amount1Desired: 1000 ether,
            amount0Min: 900 ether,
            amount1Min: 900 ether,
            recipient: alice,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(alice);
        vm.expectRevert(PositionManager.DeadlineExpired.selector);
        positionManager.mint(params);
    }

    function test_Mint_RevertWhen_InvalidTickRange() public {
        PoolKey memory poolKey = _createPoolKey();

        PositionManager.MintParams memory params = PositionManager.MintParams({
            poolKey: poolKey,
            tickLower: 600, // Invalid: lower >= upper
            tickUpper: 600,
            amount0Desired: 1000 ether,
            amount1Desired: 1000 ether,
            amount0Min: 900 ether,
            amount1Min: 900 ether,
            recipient: alice,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        vm.expectRevert(PositionManager.InvalidTickRange.selector);
        positionManager.mint(params);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INCREASE LIQUIDITY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_IncreaseLiquidity() public {
        // First mint a position
        uint256 tokenId = _mintPosition(alice);

        // Increase liquidity
        PositionManager.IncreaseLiquidityParams memory params = PositionManager.IncreaseLiquidityParams({
            tokenId: tokenId,
            amount0Desired: 500 ether,
            amount1Desired: 500 ether,
            amount0Min: 400 ether,
            amount1Min: 400 ether,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        (uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.increaseLiquidity(params);

        assertGt(liquidity, 0, "Liquidity should increase");
    }

    function test_IncreaseLiquidity_RevertWhen_Unauthorized() public {
        uint256 tokenId = _mintPosition(alice);

        PositionManager.IncreaseLiquidityParams memory params = PositionManager.IncreaseLiquidityParams({
            tokenId: tokenId,
            amount0Desired: 500 ether,
            amount1Desired: 500 ether,
            amount0Min: 400 ether,
            amount1Min: 400 ether,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(bob); // Bob doesn't own the position
        vm.expectRevert(PositionManager.Unauthorized.selector);
        positionManager.increaseLiquidity(params);
    }

    // ══════════════════════════════════════════════════════════════════════
    // DECREASE LIQUIDITY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_DecreaseLiquidity() public {
        uint256 tokenId = _mintPosition(alice);

        // Get position info
        PositionManager.Position memory position = positionManager.positions(tokenId);

        // Decrease half the liquidity
        PositionManager.DecreaseLiquidityParams memory params = PositionManager.DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: position.liquidity / 2,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        (uint256 amount0, uint256 amount1) = positionManager.decreaseLiquidity(params);

        assertGt(amount0, 0, "Amount0 should be greater than 0");
        assertGt(amount1, 0, "Amount1 should be greater than 0");
    }

    // ══════════════════════════════════════════════════════════════════════
    // COLLECT TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Collect() public {
        uint256 tokenId = _mintPosition(alice);

        // Decrease liquidity to accumulate tokens owed
        PositionManager.Position memory position = positionManager.positions(tokenId);
        PositionManager.DecreaseLiquidityParams memory decreaseParams = PositionManager.DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: position.liquidity / 2,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        positionManager.decreaseLiquidity(decreaseParams);

        // Collect fees
        PositionManager.CollectParams memory collectParams = PositionManager.CollectParams({
            tokenId: tokenId,
            recipient: alice,
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        vm.prank(alice);
        (uint256 amount0, uint256 amount1) = positionManager.collect(collectParams);

        assertGt(amount0, 0, "Should collect some token0");
        assertGt(amount1, 0, "Should collect some token1");
    }

    // ══════════════════════════════════════════════════════════════════════
    // BURN TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Burn() public {
        uint256 tokenId = _mintPosition(alice);

        // Decrease all liquidity
        PositionManager.Position memory position = positionManager.positions(tokenId);
        PositionManager.DecreaseLiquidityParams memory decreaseParams = PositionManager.DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: position.liquidity,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(alice);
        positionManager.decreaseLiquidity(decreaseParams);

        // Collect all tokens
        PositionManager.CollectParams memory collectParams = PositionManager.CollectParams({
            tokenId: tokenId,
            recipient: alice,
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        vm.prank(alice);
        positionManager.collect(collectParams);

        // Burn NFT
        vm.prank(alice);
        positionManager.burn(tokenId);

        // NFT should not exist
        vm.expectRevert();
        positionManager.ownerOf(tokenId);
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Positions() public {
        uint256 tokenId = _mintPosition(alice);

        PositionManager.Position memory position = positionManager.positions(tokenId);

        assertEq(position.tickLower, -600, "Tick lower should match");
        assertEq(position.tickUpper, 600, "Tick upper should match");
        assertGt(position.liquidity, 0, "Liquidity should be greater than 0");
    }

    function test_TokenURI() public {
        uint256 tokenId = _mintPosition(alice);

        // Should not revert (URI may be empty in base implementation)
        string memory uri = positionManager.tokenURI(tokenId);
        // Just check it doesn't revert - URI can be empty in base ERC721
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

    function _mintPosition(address owner) internal returns (uint256 tokenId) {
        PoolKey memory poolKey = _createPoolKey();

        PositionManager.MintParams memory params = PositionManager.MintParams({
            poolKey: poolKey,
            tickLower: -600,
            tickUpper: 600,
            amount0Desired: 1000 ether,
            amount1Desired: 1000 ether,
            amount0Min: 900 ether,
            amount1Min: 900 ether,
            recipient: owner,
            deadline: block.timestamp + 1 hours
        });

        vm.startPrank(owner);
        token0.approve(address(positionManager), type(uint256).max);
        token1.approve(address(positionManager), type(uint256).max);

        (tokenId,,,) = positionManager.mint(params);
        vm.stopPrank();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MEVProtectionHook} from "../../src/hooks/MEVProtectionHook.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MEVProtectionHookTest
/// @notice Comprehensive tests for MEVProtectionHook contract
contract MEVProtectionHookTest is Test {
    using CurrencyLibrary for Currency;

    PoolManager public poolManager;
    MEVProtectionHook public hook;

    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;
    bytes32 public poolId;

    address public alice;
    address public bob;
    address public attacker;
    address public whitelistedRouter;

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    event SandwichAttemptBlocked(bytes32 indexed poolId, address indexed attacker, uint256 blockNumber);
    event HighFrequencyBlocked(bytes32 indexed poolId, address indexed trader, uint256 txCount);
    event ExcessiveSlippageDetected(bytes32 indexed poolId, address indexed trader, uint256 slippageBps);
    event ProtectionEnabled(bytes32 indexed poolId);
    event ProtectionDisabled(bytes32 indexed poolId);
    event AddressWhitelisted(address indexed account);
    event SwapCommitted(address indexed sender, bytes32 indexed commitHash, uint256 commitBlock);
    event SwapRevealed(address indexed sender, bytes32 indexed commitHash, uint256 revealBlock);
    event LargeSwapDetected(
        bytes32 indexed poolId,
        address indexed sender,
        uint256 amount,
        bool shouldUsePrivateMempool
    );

    function setUp() public {
        // Deploy contracts
        poolManager = new PoolManager();
        hook = new MEVProtectionHook(address(poolManager));

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

        // Setup test addresses
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        attacker = makeAddr("attacker");
        whitelistedRouter = makeAddr("whitelistedRouter");
    }

    // ══════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constructor() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
        assertEq(hook.owner(), address(this));
    }

    function test_GetHookPermissions() public view {
        MEVProtectionHook.Permissions memory permissions = hook.getHookPermissions();

        assertEq(permissions.beforeInitialize, false);
        assertEq(permissions.afterInitialize, true);
        assertEq(permissions.beforeModifyLiquidity, false);
        assertEq(permissions.afterModifyLiquidity, false);
        assertEq(permissions.beforeSwap, true);
        assertEq(permissions.afterSwap, true);
    }

    function test_AfterInitialize() public {
        vm.expectEmit(true, false, false, true);
        emit ProtectionEnabled(poolId);

        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        assertTrue(hook.isPoolInitialized(poolId));
        assertTrue(hook.isProtectionEnabled(poolId));
        assertEq(hook.maxTxPerBlock(poolId), hook.DEFAULT_MAX_TX_PER_BLOCK());
        assertEq(hook.maxSlippageBps(poolId), hook.DEFAULT_MAX_SLIPPAGE_BPS());
        assertEq(hook.maxSenderSwapsPerBlock(poolId), hook.DEFAULT_MAX_SENDER_SWAPS_PER_BLOCK());
        assertEq(hook.commitRevealThreshold(poolId), hook.DEFAULT_COMMIT_REVEAL_THRESHOLD());
        assertFalse(hook.commitRevealEnabled(poolId));
    }

    function test_Constants() public view {
        assertEq(hook.DEFAULT_MAX_TX_PER_BLOCK(), 2);
        assertEq(hook.RATE_LIMIT_WINDOW(), 60);
        assertEq(hook.MAX_TX_PER_WINDOW(), 10);
        assertEq(hook.DEFAULT_MAX_SLIPPAGE_BPS(), 500); // 5%
        assertEq(hook.MIN_SWAP_INTERVAL(), 3);
        assertEq(hook.COMMIT_DELAY(), 2);
        assertEq(hook.MAX_COMMIT_AGE(), 50);
        assertEq(hook.DEFAULT_COMMIT_REVEAL_THRESHOLD(), 100e18);
        assertEq(hook.DEFAULT_MAX_SENDER_SWAPS_PER_BLOCK(), 3);
        assertEq(hook.PRIVATE_MEMPOOL_THRESHOLD(), 50e18);
        assertEq(hook.RATE_LIMIT_BLOCK_WINDOW(), 25);
        assertEq(hook.MAX_SWAPS_PER_BLOCK_WINDOW(), 10);
    }

    // ══════════════════════════════════════════════════════════════════════
    // SANDWICH ATTACK DETECTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_SandwichAttack_SameBlock_OppositeDirection() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // First swap: buy (zeroForOne = true)
        IPoolManager.SwapParams memory params1 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        hook.beforeSwap(attacker, poolKey, params1);
        hook.afterSwap(attacker, poolKey, params1, BalanceDelta.wrap(0));

        // Second swap: sell (zeroForOne = false) - SHOULD REVERT
        IPoolManager.SwapParams memory params2 = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: type(uint160).max
        });

        vm.expectEmit(true, true, false, true);
        emit SandwichAttemptBlocked(poolId, attacker, block.number);

        vm.expectRevert(MEVProtectionHook.SandwichAttackDetected.selector);
        hook.beforeSwap(attacker, poolKey, params2);
    }

    function test_SandwichAttack_SameBlock_SameDirection_Allowed() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // First swap: buy
        IPoolManager.SwapParams memory params1 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        hook.beforeSwap(alice, poolKey, params1);
        hook.afterSwap(alice, poolKey, params1, BalanceDelta.wrap(0));

        // Second swap: buy again (same direction) - SHOULD SUCCEED (but hit frequency limit)
        vm.expectRevert(MEVProtectionHook.TransactionFrequencyExceeded.selector);
        hook.beforeSwap(alice, poolKey, params1);
    }

    function test_SandwichAttack_CrossBlock_Detection() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Block N: Attacker buys
        IPoolManager.SwapParams memory params1 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        hook.beforeSwap(attacker, poolKey, params1);
        hook.afterSwap(attacker, poolKey, params1, BalanceDelta.wrap(0));

        // Move to next block
        vm.roll(block.number + 1);

        // Victim trades in Block N+1
        vm.prank(bob);
        hook.beforeSwap(bob, poolKey, params1);
        vm.prank(bob);
        hook.afterSwap(bob, poolKey, params1, BalanceDelta.wrap(0));

        // Attacker tries to sell in Block N+1 (completing sandwich)
        IPoolManager.SwapParams memory params2 = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: type(uint160).max
        });

        vm.expectEmit(true, true, false, true);
        emit SandwichAttemptBlocked(poolId, attacker, block.number);

        vm.expectRevert(MEVProtectionHook.SandwichAttackDetected.selector);
        hook.beforeSwap(attacker, poolKey, params2);
    }

    function test_NormalTrading_DifferentUsers_Allowed() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Alice trades
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Bob trades (different user) - SHOULD SUCCEED
        hook.beforeSwap(bob, poolKey, params);
        hook.afterSwap(bob, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getSwapCount(poolId, alice), 1);
        assertEq(hook.getSwapCount(poolId, bob), 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TRANSACTION FREQUENCY TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_BlockFrequencyLimit_Exceeded() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // First swap: OK
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Wait for MIN_SWAP_INTERVAL
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        // Second swap in same block: OK (reaches limit of 2)
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Wait for MIN_SWAP_INTERVAL
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        // Third swap in same block: SHOULD REVERT
        vm.expectEmit(true, true, false, true);
        emit HighFrequencyBlocked(poolId, alice, 2);

        vm.expectRevert(MEVProtectionHook.TransactionFrequencyExceeded.selector);
        hook.beforeSwap(alice, poolKey, params);
    }

    function test_BlockFrequencyLimit_ResetsNextBlock() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Fill quota in Block N
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Move to next block
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        // Should be able to trade again
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getSwapCount(poolId, alice), 1);
    }

    function test_MinSwapInterval_Enforced() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // First swap
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Try immediate second swap (< MIN_SWAP_INTERVAL)
        vm.warp(block.timestamp + 1);

        vm.expectRevert(MEVProtectionHook.TransactionFrequencyExceeded.selector);
        hook.beforeSwap(alice, poolKey, params);

        // Wait for MIN_SWAP_INTERVAL
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL());

        // Should work now
        hook.beforeSwap(alice, poolKey, params);
    }

    function test_RateLimit_Window_Enforced() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Execute MAX_TX_PER_WINDOW (10) swaps
        // Make sure we stay within the RATE_LIMIT_WINDOW (60 seconds)
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < hook.MAX_TX_PER_WINDOW(); i++) {
            currentBlock++;
            vm.roll(currentBlock);
            // Use small time increments to stay within window
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        // 11th swap within window should fail
        currentBlock++;
        vm.roll(currentBlock);
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

        vm.expectEmit(true, true, false, false);
        emit HighFrequencyBlocked(poolId, alice, 0); // Count will be checked

        vm.expectRevert(MEVProtectionHook.TransactionFrequencyExceeded.selector);
        hook.beforeSwap(alice, poolKey, params);
    }

    function test_RateLimit_Window_Expires() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Execute swaps
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 5; i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        // Wait for rate limit window to expire + move blocks beyond RATE_LIMIT_BLOCK_WINDOW
        vm.warp(block.timestamp + hook.RATE_LIMIT_WINDOW() + 10);
        currentBlock += hook.RATE_LIMIT_BLOCK_WINDOW() + 1;
        vm.roll(currentBlock);

        // Should be able to trade again
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // WHITELIST TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Whitelist_BypassesAllChecks() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Add router to whitelist
        vm.expectEmit(true, false, false, false);
        emit AddressWhitelisted(whitelistedRouter);

        hook.addToWhitelist(whitelistedRouter);
        assertTrue(hook.isWhitelisted(whitelistedRouter));

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Whitelisted address can swap multiple times without limits
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(whitelistedRouter);
            hook.beforeSwap(whitelistedRouter, poolKey, params);
            vm.prank(whitelistedRouter);
            hook.afterSwap(whitelistedRouter, poolKey, params, BalanceDelta.wrap(0));
        }

        // Swap count should still be 0 (not tracked for whitelisted)
        assertEq(hook.getSwapCount(poolId, whitelistedRouter), 0);
    }

    function test_Whitelist_CanTradeOppositeDirections() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
        hook.addToWhitelist(whitelistedRouter);

        // Buy
        IPoolManager.SwapParams memory params1 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        vm.prank(whitelistedRouter);
        hook.beforeSwap(whitelistedRouter, poolKey, params1);
        vm.prank(whitelistedRouter);
        hook.afterSwap(whitelistedRouter, poolKey, params1, BalanceDelta.wrap(0));

        // Sell (opposite direction) - should NOT revert
        IPoolManager.SwapParams memory params2 = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: type(uint160).max
        });

        vm.prank(whitelistedRouter);
        hook.beforeSwap(whitelistedRouter, poolKey, params2);
        vm.prank(whitelistedRouter);
        hook.afterSwap(whitelistedRouter, poolKey, params2, BalanceDelta.wrap(0));
    }

    function test_RemoveFromWhitelist() public {
        hook.addToWhitelist(whitelistedRouter);
        assertTrue(hook.isWhitelisted(whitelistedRouter));

        hook.removeFromWhitelist(whitelistedRouter);
        assertFalse(hook.isWhitelisted(whitelistedRouter));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_EnableProtection() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Disable first
        hook.disableProtection(poolId);
        assertFalse(hook.isProtectionEnabled(poolId));

        // Re-enable
        vm.expectEmit(true, false, false, false);
        emit ProtectionEnabled(poolId);

        hook.enableProtection(poolId);
        assertTrue(hook.isProtectionEnabled(poolId));
    }

    function test_DisableProtection() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.expectEmit(true, false, false, false);
        emit ProtectionDisabled(poolId);

        hook.disableProtection(poolId);
        assertFalse(hook.isProtectionEnabled(poolId));

        // Should be able to bypass all checks
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        for (uint256 i = 0; i < 5; i++) {
            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }
    }

    function test_UpdateParameters() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        uint256 newMaxTx = 5;
        uint256 newMaxSlippage = 1000; // 10%

        hook.updateParameters(poolId, newMaxTx, newMaxSlippage);

        assertEq(hook.maxTxPerBlock(poolId), newMaxTx);
        assertEq(hook.maxSlippageBps(poolId), newMaxSlippage);
    }

    function test_UpdateParameters_RevertWhen_Unauthorized() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.updateParameters(poolId, 5, 1000);
    }

    function test_UpdateParameters_RevertWhen_InvalidParameters() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.updateParameters(poolId, 0, 1000);

        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.updateParameters(poolId, 5, 0);
    }

    function test_AddToWhitelist_RevertWhen_Unauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.addToWhitelist(bob);
    }

    function test_AddToWhitelist_RevertWhen_ZeroAddress() public {
        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.addToWhitelist(address(0));
    }

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        // Ownable2Step: first transferOwnership (starts the process), then acceptOwnership
        hook.transferOwnership(newOwner);

        // Owner hasn't changed yet (2-step)
        assertEq(hook.owner(), address(this));
        assertEq(hook.pendingOwner(), newOwner);

        // New owner accepts
        vm.prank(newOwner);
        hook.acceptOwnership();
        assertEq(hook.owner(), newOwner);
    }

    function test_TransferOwnership_RevertWhen_Unauthorized() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.transferOwnership(newOwner);
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_CanSwap_ProtectionDisabled() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
        hook.disableProtection(poolId);

        (bool canSwap, string memory reason) = hook.canSwap(poolId, alice);
        assertTrue(canSwap);
        assertEq(reason, "Protection disabled");
    }

    function test_CanSwap_Whitelisted() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
        hook.addToWhitelist(whitelistedRouter);

        (bool canSwap, string memory reason) = hook.canSwap(poolId, whitelistedRouter);
        assertTrue(canSwap);
        assertEq(reason, "Whitelisted");
    }

    function test_CanSwap_OK() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        (bool canSwap, string memory reason) = hook.canSwap(poolId, alice);
        assertTrue(canSwap);
        assertEq(reason, "OK");
    }

    function test_CanSwap_BlockFrequencyExceeded() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Fill quota
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        (bool canSwap, string memory reason) = hook.canSwap(poolId, alice);
        assertFalse(canSwap);
        assertEq(reason, "Block frequency limit exceeded");
    }

    function test_GetPoolParameters() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        (bool protectionEnabled, uint256 maxTx, uint256 maxSlippage) = hook.getPoolParameters(poolId);

        assertTrue(protectionEnabled);
        assertEq(maxTx, hook.DEFAULT_MAX_TX_PER_BLOCK());
        assertEq(maxSlippage, hook.DEFAULT_MAX_SLIPPAGE_BPS());
    }

    function test_GetRecentSwaps() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Make some swaps (move to new block for each to avoid block frequency limit)
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 3; i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 10);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        uint256[] memory timestamps = hook.getRecentSwaps(poolId, alice);
        assertEq(timestamps.length, 3);
    }

    // ══════════════════════════════════════════════════════════════════════
    // EDGE CASE TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_BeforeSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 5000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        vm.expectRevert(MEVProtectionHook.PoolNotInitialized.selector);
        hook.beforeSwap(alice, uninitializedKey, params);
    }

    function test_AfterSwap_RevertWhen_PoolNotInitialized() public {
        PoolKey memory uninitializedKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 5000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        vm.expectRevert(MEVProtectionHook.PoolNotInitialized.selector);
        hook.afterSwap(alice, uninitializedKey, params, BalanceDelta.wrap(0));
    }

    function test_MultipleUsers_IndependentLimits() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Alice uses her quota
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        // Bob should have independent quota
        hook.beforeSwap(bob, poolKey, params);
        hook.afterSwap(bob, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getSwapCount(poolId, alice), 1);
        assertEq(hook.getSwapCount(poolId, bob), 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // BOUNDED ARRAY / GAS DoS PROTECTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Constants_BoundedArrayLimits() public view {
        assertEq(hook.MAX_SWAP_HISTORY(), 100);
        assertEq(hook.MAX_SWAP_TIMESTAMPS(), 100);
        assertEq(hook.MAX_SWAP_BLOCK_NUMBERS(), 100);
    }

    function test_BlockSwapLimit_Enforced() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Increase max tx per block and sender limit so we can push many swaps
        hook.updateParameters(poolId, 200, hook.DEFAULT_MAX_SLIPPAGE_BPS());
        hook.updateMaxSenderSwapsPerBlock(poolId, 200);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Push MAX_SWAP_HISTORY swaps from unique senders in the same block
        for (uint256 i = 0; i < hook.MAX_SWAP_HISTORY(); i++) {
            address sender = address(uint160(0x1000 + i));
            hook.addToWhitelist(sender);
            // Whitelisted addresses skip the blockSwaps push, so we need non-whitelisted
        }

        // Use non-whitelisted senders with unique addresses to avoid sandwich/frequency checks
        for (uint256 i = 0; i < hook.MAX_SWAP_HISTORY(); i++) {
            address sender = address(uint160(0x1000 + i));
            hook.removeFromWhitelist(sender); // Undo whitelist
            hook.beforeSwap(sender, poolKey, params);
            hook.afterSwap(sender, poolKey, params, BalanceDelta.wrap(0));
        }

        // Verify the count
        assertEq(hook.getBlockSwapCount(poolId, block.number), hook.MAX_SWAP_HISTORY());

        // Next swap should revert with BlockSwapLimitReached
        address extraSender = address(uint160(0x1000 + hook.MAX_SWAP_HISTORY()));
        vm.expectRevert(MEVProtectionHook.BlockSwapLimitReached.selector);
        hook.beforeSwap(extraSender, poolKey, params);
    }

    function test_PruneBlockSwaps() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Swap happens at block 1 (default foundry block)
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getBlockSwapCount(poolId, 1), 1);

        // Move to block 100 so block 1 is in the past
        vm.roll(100);

        // Prune block 1
        hook.pruneBlockSwaps(poolId, 1);
        assertEq(hook.getBlockSwapCount(poolId, 1), 0);
    }

    function test_PruneBlockSwaps_RevertWhen_CurrentBlock() public {
        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.pruneBlockSwaps(poolId, block.number);
    }

    function test_PruneBlockSwaps_RevertWhen_FutureBlock() public {
        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.pruneBlockSwaps(poolId, block.number + 10);
    }

    function test_SwapTimestamps_CappedAtMax() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Increase rate limit to allow many swaps
        hook.updateParameters(poolId, 200, hook.DEFAULT_MAX_SLIPPAGE_BPS());
        hook.updateMaxSenderSwapsPerBlock(poolId, 200);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 5; i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        // Check timestamps array is bounded
        uint256[] memory timestamps = hook.getRecentSwaps(poolId, alice);
        assertTrue(timestamps.length <= hook.MAX_SWAP_TIMESTAMPS());
    }

    function test_GetBlockSwapCount() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Initially zero
        assertEq(hook.getBlockSwapCount(poolId, block.number), 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        hook.beforeSwap(alice, poolKey, params);
        assertEq(hook.getBlockSwapCount(poolId, block.number), 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // COMMIT-REVEAL SCHEME TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_CommitSwap_Success() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Verify commit exists
        (bool exists, bool mature, bool expired) = hook.getCommitStatus(alice, commitHash);
        assertTrue(exists);
        assertFalse(mature); // Not enough blocks have passed
        assertFalse(expired);
    }

    function test_CommitSwap_RevertWhen_ZeroHash() public {
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.commitSwap(bytes32(0));
    }

    function test_CommitSwap_RevertWhen_DuplicateCommit() public {
        bytes32 commitHash = keccak256("test_commit");

        vm.prank(alice);
        hook.commitSwap(commitHash);

        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.InvalidParameters.selector);
        hook.commitSwap(commitHash);
    }

    function test_RevealSwap_Success() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Wait COMMIT_DELAY blocks
        vm.roll(block.number + hook.COMMIT_DELAY());

        // Verify commit is mature
        (bool exists, bool mature, bool expired) = hook.getCommitStatus(alice, commitHash);
        assertTrue(exists);
        assertTrue(mature);
        assertFalse(expired);

        // Reveal
        vm.prank(alice);
        bytes32 returnedHash = hook.revealSwap(poolId, true, int256(1e18), secret);
        assertEq(returnedHash, commitHash);

        // Verify commit is consumed
        (exists,,) = hook.getCommitStatus(alice, commitHash);
        assertFalse(exists);
    }

    function test_RevealSwap_RevertWhen_CommitNotFound() public {
        bytes32 secret = keccak256("nonexistent");

        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotFound.selector);
        hook.revealSwap(poolId, true, int256(1e18), secret);
    }

    function test_RevealSwap_RevertWhen_NotMatured() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Try to reveal immediately (not enough blocks)
        vm.roll(block.number + 1); // Only 1 block, need COMMIT_DELAY (2)

        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotMatured.selector);
        hook.revealSwap(poolId, true, int256(1e18), secret);
    }

    function test_RevealSwap_RevertWhen_Expired() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Wait beyond MAX_COMMIT_AGE
        vm.roll(block.number + hook.MAX_COMMIT_AGE() + 1);

        // Verify commit is expired
        (bool exists, bool mature, bool expired) = hook.getCommitStatus(alice, commitHash);
        assertTrue(exists);
        assertTrue(mature);
        assertTrue(expired);

        // Reveal should fail
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitExpired.selector);
        hook.revealSwap(poolId, true, int256(1e18), secret);
    }

    function test_RevealSwap_RevertWhen_WrongParams() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Wait for maturity
        vm.roll(block.number + hook.COMMIT_DELAY());

        // Try to reveal with wrong amount - the hash won't match any commit
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotFound.selector);
        hook.revealSwap(poolId, true, int256(2e18), secret); // Wrong amount
    }

    function test_RevealSwap_RevertWhen_WrongSecret() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Wait for maturity
        vm.roll(block.number + hook.COMMIT_DELAY());

        // Try to reveal with wrong secret
        bytes32 wrongSecret = keccak256("wrong_secret");
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotFound.selector);
        hook.revealSwap(poolId, true, int256(1e18), wrongSecret);
    }

    function test_CommitReveal_CannotReplay() public {
        bytes32 secret = keccak256("my_secret");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(1e18), secret));

        // Commit
        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Wait for maturity
        vm.roll(block.number + hook.COMMIT_DELAY());

        // First reveal succeeds
        vm.prank(alice);
        hook.revealSwap(poolId, true, int256(1e18), secret);

        // Second reveal fails (consumed)
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotFound.selector);
        hook.revealSwap(poolId, true, int256(1e18), secret);
    }

    // ══════════════════════════════════════════════════════════════════════
    // BLOCK-BASED RATE LIMITING TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_SenderSwapLimitPerBlock() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Set max tx per block high but sender limit to 2
        hook.updateParameters(poolId, 10, hook.DEFAULT_MAX_SLIPPAGE_BPS());
        hook.updateMaxSenderSwapsPerBlock(poolId, 2);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // First swap OK
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        // Second swap OK
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        // Third swap should hit sender limit
        vm.expectRevert(MEVProtectionHook.SenderSwapLimitPerBlockReached.selector);
        hook.beforeSwap(alice, poolKey, params);
    }

    function test_SenderSwapLimitDisabled() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Disable sender limit by setting to 0
        hook.updateMaxSenderSwapsPerBlock(poolId, 0);
        hook.updateParameters(poolId, 10, hook.DEFAULT_MAX_SLIPPAGE_BPS());

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Should be able to swap up to maxTxPerBlock (10) without sender limit
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);
            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }
    }

    function test_BlockBasedRateLimit() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Set high per-block limits so we test the block window rate limit
        hook.updateParameters(poolId, 200, hook.DEFAULT_MAX_SLIPPAGE_BPS());
        hook.updateMaxSenderSwapsPerBlock(poolId, 200);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Execute MAX_SWAPS_PER_BLOCK_WINDOW swaps across different blocks within the window
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < hook.MAX_SWAPS_PER_BLOCK_WINDOW(); i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        // Next swap should fail due to block rate limit
        currentBlock++;
        vm.roll(currentBlock);
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

        vm.expectRevert(MEVProtectionHook.TransactionFrequencyExceeded.selector);
        hook.beforeSwap(alice, poolKey, params);
    }

    function test_BlockBasedRateLimit_ExpiresAfterWindow() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        hook.updateParameters(poolId, 200, hook.DEFAULT_MAX_SLIPPAGE_BPS());
        hook.updateMaxSenderSwapsPerBlock(poolId, 200);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Execute some swaps
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 5; i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 2);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        // Move past the block window + time window
        currentBlock += hook.RATE_LIMIT_BLOCK_WINDOW() + 1;
        vm.roll(currentBlock);
        vm.warp(block.timestamp + hook.RATE_LIMIT_WINDOW() + 10);

        // Should be able to swap again
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
    }

    function test_LastSwapBlock_Tracked() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // Initially zero
        assertEq(hook.getLastSwapBlock(poolId, alice), 0);

        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getLastSwapBlock(poolId, alice), block.number);

        // Move to next block and swap again
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 1);

        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));

        assertEq(hook.getLastSwapBlock(poolId, alice), block.number);
    }

    function test_GetRecentSwapBlocks() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 3; i++) {
            currentBlock++;
            vm.roll(currentBlock);
            vm.warp(block.timestamp + hook.MIN_SWAP_INTERVAL() + 10);

            hook.beforeSwap(alice, poolKey, params);
            hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
        }

        uint256[] memory blockNums = hook.getRecentSwapBlocks(poolId, alice);
        assertEq(blockNums.length, 3);
    }

    // ══════════════════════════════════════════════════════════════════════
    // PRIVATE MEMPOOL RECOMMENDATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_GetRecommendedSubmissionMethod_LargeSwap() public view {
        (bool usePrivate, string memory reason) = hook.getRecommendedSubmissionMethod(100e18);
        assertTrue(usePrivate);
        assertEq(reason, "Large swap: use Flashbots Protect or private mempool to avoid frontrunning");
    }

    function test_GetRecommendedSubmissionMethod_SmallSwap() public view {
        (bool usePrivate, string memory reason) = hook.getRecommendedSubmissionMethod(10e18);
        assertFalse(usePrivate);
        assertEq(reason, "Standard submission is acceptable for this swap size");
    }

    function test_GetRecommendedSubmissionMethod_AtThreshold() public view {
        (bool usePrivate,) = hook.getRecommendedSubmissionMethod(hook.PRIVATE_MEMPOOL_THRESHOLD());
        assertTrue(usePrivate);
    }

    function test_GetRecommendedSubmissionMethod_BelowThreshold() public view {
        (bool usePrivate,) = hook.getRecommendedSubmissionMethod(hook.PRIVATE_MEMPOOL_THRESHOLD() - 1);
        assertFalse(usePrivate);
    }

    function test_LargeSwapDetected_EventEmitted() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Large swap that exceeds PRIVATE_MEMPOOL_THRESHOLD
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: int256(hook.PRIVATE_MEMPOOL_THRESHOLD()),
            sqrtPriceLimitX96: 0
        });

        vm.expectEmit(true, true, false, true);
        emit LargeSwapDetected(poolId, alice, hook.PRIVATE_MEMPOOL_THRESHOLD(), true);

        hook.beforeSwap(alice, poolKey, params);
    }

    function test_SmallSwap_NoLargeSwapEvent() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Small swap below threshold
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e18,
            sqrtPriceLimitX96: 0
        });

        // This should not emit LargeSwapDetected - swap should just succeed
        hook.beforeSwap(alice, poolKey, params);
        hook.afterSwap(alice, poolKey, params, BalanceDelta.wrap(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // COMMIT-REVEAL ADMIN CONFIG TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_UpdateCommitRevealConfig() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        hook.updateCommitRevealConfig(poolId, 200e18, true);

        assertEq(hook.commitRevealThreshold(poolId), 200e18);
        assertTrue(hook.commitRevealEnabled(poolId));

        // Disable
        hook.updateCommitRevealConfig(poolId, 0, false);
        assertEq(hook.commitRevealThreshold(poolId), 0);
        assertFalse(hook.commitRevealEnabled(poolId));
    }

    function test_UpdateCommitRevealConfig_RevertWhen_Unauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.updateCommitRevealConfig(poolId, 200e18, true);
    }

    function test_UpdateMaxSenderSwapsPerBlock() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        hook.updateMaxSenderSwapsPerBlock(poolId, 5);
        assertEq(hook.maxSenderSwapsPerBlock(poolId), 5);
    }

    function test_UpdateMaxSenderSwapsPerBlock_RevertWhen_Unauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        hook.updateMaxSenderSwapsPerBlock(poolId, 5);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTEGRATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_FullSandwichScenario() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Attacker front-runs (block N)
        IPoolManager.SwapParams memory frontRun = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 10e18,
            sqrtPriceLimitX96: 0
        });

        vm.prank(attacker);
        hook.beforeSwap(attacker, poolKey, frontRun);
        vm.prank(attacker);
        hook.afterSwap(attacker, poolKey, frontRun, BalanceDelta.wrap(0));

        // Victim trades (block N+1)
        vm.roll(block.number + 1);

        IPoolManager.SwapParams memory victimSwap = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 5e18,
            sqrtPriceLimitX96: 0
        });

        vm.prank(bob);
        hook.beforeSwap(bob, poolKey, victimSwap);
        vm.prank(bob);
        hook.afterSwap(bob, poolKey, victimSwap, BalanceDelta.wrap(0));

        // Attacker tries to back-run (same block) - BLOCKED
        IPoolManager.SwapParams memory backRun = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 10e18,
            sqrtPriceLimitX96: type(uint160).max
        });

        vm.expectRevert(MEVProtectionHook.SandwichAttackDetected.selector);
        vm.prank(attacker);
        hook.beforeSwap(attacker, poolKey, backRun);
    }

    function test_FullCommitRevealFlow() public {
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);

        // Step 1: Alice commits her swap parameters
        bytes32 secret = keccak256("alice_secret_123");
        bytes32 commitHash = keccak256(abi.encodePacked(poolId, alice, true, int256(100e18), secret));

        vm.prank(alice);
        hook.commitSwap(commitHash);

        // Step 2: Wait for COMMIT_DELAY blocks
        vm.roll(block.number + hook.COMMIT_DELAY());

        // Step 3: Alice reveals her swap
        vm.prank(alice);
        bytes32 revealedHash = hook.revealSwap(poolId, true, int256(100e18), secret);
        assertEq(revealedHash, commitHash);

        // Step 4: The commit is consumed, cannot be reused
        vm.prank(alice);
        vm.expectRevert(MEVProtectionHook.CommitNotFound.selector);
        hook.revealSwap(poolId, true, int256(100e18), secret);
    }
}

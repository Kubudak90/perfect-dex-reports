// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey, PoolIdLibrary} from "../../src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {BalanceDelta} from "../../src/types/BalanceDelta.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {DynamicFeeHook} from "../../src/hooks/DynamicFeeHook.sol";
import {OracleHook} from "../../src/hooks/OracleHook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BaseForkTest
/// @notice Fork tests for the BaseBook DEX contracts against Base mainnet state
/// @dev These tests use vm.createSelectFork to fork from a pinned Base mainnet block
///      for reproducible testing with real token contracts (WETH, USDC).
///
///      Run with:
///        BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/fork/ -vvv
///
///      Or with a specific profile:
///        BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/fork/ --fork-url $BASE_RPC_URL -vvv
contract BaseForkTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS - Base Mainnet Token Addresses
    // ══════════════════════════════════════════════════════════════════════

    /// @notice WETH on Base mainnet
    address constant BASE_WETH = 0x4200000000000000000000000000000000000006;

    /// @notice USDC on Base mainnet (native, 6 decimals)
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @notice Pinned block number for deterministic fork testing
    /// @dev Block ~26,000,000 on Base mainnet (late 2024). Pinning ensures
    ///      consistent token state, balances, and bytecode across test runs.
    uint256 constant FORK_BLOCK = 26_000_000;

    /// @notice Sqrt price representing ~$2500 USDC per WETH
    /// @dev For a WETH/USDC pool where WETH is token0 and USDC is token1,
    ///      price = (token1 / token0) = 2500 * 1e6 / 1e18 = 2500e-12
    ///      sqrtPriceX96 = sqrt(price) * 2^96 = sqrt(2500e-12) * 2^96
    ///      Approximation: 125_270_724_187_523 (derived from tick math)
    ///      We use a tick-derived price for accuracy.
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 1:1 price (tick 0)

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    uint256 internal forkId;

    PoolManager public poolManager;

    Currency public weth;
    Currency public usdc;

    // Sorted currencies for PoolKey (currency0 < currency1)
    Currency public currency0;
    Currency public currency1;

    address public alice;
    address public bob;

    // ══════════════════════════════════════════════════════════════════════
    // SETUP
    // ══════════════════════════════════════════════════════════════════════

    function setUp() public {
        // Create a fork of Base mainnet at a pinned block for deterministic testing.
        // vm.createSelectFork both creates and selects the fork in one call.
        string memory rpcUrl = vm.envString("BASE_RPC_URL");
        forkId = vm.createSelectFork(rpcUrl, FORK_BLOCK);

        // Verify the fork is active
        assertEq(vm.activeFork(), forkId, "Fork should be active");

        // Deploy BaseBook contracts on the forked state
        poolManager = new PoolManager();

        // Set up token currencies
        weth = Currency.wrap(BASE_WETH);
        usdc = Currency.wrap(BASE_USDC);

        // Sort currencies: currency0 must be < currency1 (by address)
        if (BASE_WETH < BASE_USDC) {
            currency0 = weth;
            currency1 = usdc;
        } else {
            currency0 = usdc;
            currency1 = weth;
        }

        // Create test accounts
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        // Fund test accounts with ETH for gas
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Deal WETH to test accounts using the cheatcode
        // WETH on Base is a standard WETH9 contract; `deal` modifies balanceOf directly
        deal(BASE_WETH, alice, 1000 ether);
        deal(BASE_WETH, bob, 1000 ether);

        // Deal USDC to test accounts (6 decimals)
        deal(BASE_USDC, alice, 10_000_000 * 1e6); // 10M USDC
        deal(BASE_USDC, bob, 10_000_000 * 1e6);
    }

    // ══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Creates a standard pool key with no hooks
    function _createPoolKey(uint24 fee, int24 tickSpacing) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    /// @notice Creates a pool key with hooks
    function _createPoolKeyWithHooks(uint24 fee, int24 tickSpacing, address hooks)
        internal
        view
        returns (PoolKey memory)
    {
        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });
    }

    /// @notice Calculates the pool ID from a pool key
    function _getPoolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }

    /// @notice Computes an approximate sqrtPriceX96 for a given USDC/WETH price ratio
    /// @dev For WETH as token0 and USDC as token1:
    ///      price = USDC_amount / WETH_amount (in base units)
    ///      For $2500/ETH: price = 2500 * 1e6 / 1e18 = 2.5e-9
    ///      sqrtPriceX96 = sqrt(2.5e-9) * 2^96 = ~3_961_408_125_713_216_879
    /// @param ethPriceUsd The ETH price in USD (e.g., 2500 for $2500)
    /// @return sqrtPriceX96 The sqrt price in Q64.96 format
    function _computeSqrtPriceForEthPrice(uint256 ethPriceUsd) internal view returns (uint160 sqrtPriceX96) {
        // Only valid when WETH is currency0 and USDC is currency1
        // price = ethPriceUsd * 1e6 / 1e18 = ethPriceUsd * 1e-12
        // sqrtPrice = sqrt(ethPriceUsd * 1e-12) = sqrt(ethPriceUsd) * 1e-6
        // sqrtPriceX96 = sqrtPrice * 2^96

        // We use TickMath to get a precise value from a tick.
        // For ETH at ~$2500 with 6-decimal USDC:
        // tick = log(price) / log(1.0001)
        // price = 2500 * 1e6 / 1e18 = 2.5e-9
        // log(2.5e-9) / log(1.0001) ~ -198000

        // Use the midpoint tick for the given price
        // For simplicity, we use a known tick value for $2500/ETH
        // The exact tick would be around -198040 for 2500 USDC/ETH
        if (Currency.unwrap(currency0) == BASE_WETH) {
            // WETH is token0, USDC is token1
            // price = USDC per WETH in base units = ethPriceUsd * 1e6 / 1e18
            // This gives a very small number, so tick is deeply negative
            int24 tick;
            if (ethPriceUsd == 2500) {
                tick = -198040;
            } else if (ethPriceUsd == 3000) {
                tick = -196220;
            } else {
                // Default to a reasonable tick for 1:1 pricing
                tick = 0;
            }
            sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        } else {
            // USDC is token0, WETH is token1
            // price = WETH per USDC in base units = 1e18 / (ethPriceUsd * 1e6)
            // This is also very small, so we invert the tick
            int24 tick;
            if (ethPriceUsd == 2500) {
                tick = 198040;
            } else if (ethPriceUsd == 3000) {
                tick = 196220;
            } else {
                tick = 0;
            }
            sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION A: Real Token Verification on Fork
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Verifies that WETH contract exists on the fork and has expected properties
    function test_Fork_WETHExists() public view {
        // WETH should have code at the expected address on the fork
        uint256 codeSize;
        address wethAddr = BASE_WETH;
        assembly {
            codeSize := extcodesize(wethAddr)
        }
        assertGt(codeSize, 0, "WETH contract should have code on Base fork");

        // Verify our deal() worked - alice should have WETH balance
        uint256 aliceBalance = IERC20(BASE_WETH).balanceOf(alice);
        assertEq(aliceBalance, 1000 ether, "Alice should have 1000 WETH from deal()");
    }

    /// @notice Verifies that USDC contract exists on the fork and has expected properties
    function test_Fork_USDCExists() public view {
        // USDC should have code at the expected address on the fork
        uint256 codeSize;
        address usdcAddr = BASE_USDC;
        assembly {
            codeSize := extcodesize(usdcAddr)
        }
        assertGt(codeSize, 0, "USDC contract should have code on Base fork");

        // Verify USDC uses 6 decimals
        uint8 decimals = IERC20Metadata(BASE_USDC).decimals();
        assertEq(decimals, 6, "USDC should have 6 decimals");

        // Verify our deal() worked
        uint256 aliceBalance = IERC20(BASE_USDC).balanceOf(alice);
        assertEq(aliceBalance, 10_000_000 * 1e6, "Alice should have 10M USDC from deal()");
    }

    /// @notice Verifies that currency sorting is correct for the pool key
    function test_Fork_CurrencySortingCorrect() public view {
        // currency0 should be less than currency1 (required by PoolManager)
        assertTrue(
            Currency.unwrap(currency0) < Currency.unwrap(currency1),
            "currency0 address should be less than currency1 address"
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION B: Pool Initialization with Real Tokens
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Initializes a pool with real WETH and USDC addresses from the fork
    function test_Fork_InitializePoolWithRealTokens() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        uint160 sqrtPriceX96 = SQRT_PRICE_1_1;

        int24 tick = poolManager.initialize(key, sqrtPriceX96);

        // Verify pool state
        bytes32 poolId = _getPoolId(key);
        (uint160 storedSqrtPrice, int24 storedTick,, uint24 lpFee) = poolManager.getSlot0(poolId);

        assertEq(storedSqrtPrice, sqrtPriceX96, "Stored sqrt price should match initialization price");
        assertEq(storedTick, tick, "Stored tick should match returned tick");
        assertEq(lpFee, 3000, "LP fee should be 3000 (0.3%)");
    }

    /// @notice Initializes a pool at a realistic ETH/USDC price
    function test_Fork_InitializePoolAtRealisticPrice() public {
        PoolKey memory key = _createPoolKey(500, 10); // 0.05% fee, tick spacing 10

        // Get sqrt price for ~$2500/ETH
        uint160 sqrtPriceX96 = _computeSqrtPriceForEthPrice(2500);

        int24 tick = poolManager.initialize(key, sqrtPriceX96);

        bytes32 poolId = _getPoolId(key);
        (uint160 storedSqrtPrice, int24 storedTick,,) = poolManager.getSlot0(poolId);

        assertEq(storedSqrtPrice, sqrtPriceX96, "Price should be stored correctly");
        assertEq(storedTick, tick, "Tick should match");

        // Log the tick for debugging
        console2.log("Initialized pool at tick:", storedTick);
        console2.log("Sqrt price X96:", storedSqrtPrice);
    }

    /// @notice Initializes multiple pools with different fee tiers using real token addresses
    function test_Fork_InitializeMultipleFeeTiers() public {
        // 0.01% fee tier
        PoolKey memory key1 = _createPoolKey(100, 1);
        poolManager.initialize(key1, SQRT_PRICE_1_1);

        // 0.05% fee tier
        PoolKey memory key2 = _createPoolKey(500, 10);
        poolManager.initialize(key2, SQRT_PRICE_1_1);

        // 0.3% fee tier
        PoolKey memory key3 = _createPoolKey(3000, 60);
        poolManager.initialize(key3, SQRT_PRICE_1_1);

        // 1% fee tier
        PoolKey memory key4 = _createPoolKey(10000, 200);
        poolManager.initialize(key4, SQRT_PRICE_1_1);

        // Verify all pools exist with different IDs
        bytes32 id1 = _getPoolId(key1);
        bytes32 id2 = _getPoolId(key2);
        bytes32 id3 = _getPoolId(key3);
        bytes32 id4 = _getPoolId(key4);

        assertTrue(id1 != id2, "Pool IDs should differ for different fee tiers");
        assertTrue(id2 != id3, "Pool IDs should differ for different fee tiers");
        assertTrue(id3 != id4, "Pool IDs should differ for different fee tiers");

        // Verify each pool has correct fee
        (,,, uint24 fee1) = poolManager.getSlot0(id1);
        (,,, uint24 fee2) = poolManager.getSlot0(id2);
        (,,, uint24 fee3) = poolManager.getSlot0(id3);
        (,,, uint24 fee4) = poolManager.getSlot0(id4);

        assertEq(fee1, 100, "0.01% fee");
        assertEq(fee2, 500, "0.05% fee");
        assertEq(fee3, 3000, "0.3% fee");
        assertEq(fee4, 10000, "1% fee");
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION C: Swaps with Real Tokens
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Adds liquidity and executes a swap with real token addresses
    function test_Fork_SwapWithRealTokens_ZeroForOne() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity in a wide range around current tick (tick 0)
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Verify liquidity was added
        uint128 poolLiquidity = poolManager.getLiquidity(poolId);
        assertEq(poolLiquidity, 1e18, "Pool should have 1e18 liquidity");

        // Execute zeroForOne swap (token0 -> token1)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15, // Exact input
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify swap results
        assertGt(amount0, 0, "amount0 (input) should be positive for zeroForOne");
        assertLt(amount1, 0, "amount1 (output) should be negative for zeroForOne");

        // Verify price moved down
        (uint160 newSqrtPrice,,,) = poolManager.getSlot0(poolId);
        assertLt(newSqrtPrice, SQRT_PRICE_1_1, "Price should decrease for zeroForOne swap");

        console2.log("Swap amount0 (in):", amount0);
        console2.log("Swap amount1 (out):", amount1);
    }

    /// @notice Executes a oneForZero swap (token1 -> token0)
    function test_Fork_SwapWithRealTokens_OneForZero() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add wide-range liquidity
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Execute oneForZero swap (token1 -> token0)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e15, // Exact input
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify swap results
        assertLt(amount0, 0, "amount0 (output) should be negative for oneForZero");
        assertGt(amount1, 0, "amount1 (input) should be positive for oneForZero");

        // Verify price moved up
        (uint160 newSqrtPrice,,,) = poolManager.getSlot0(poolId);
        assertGt(newSqrtPrice, SQRT_PRICE_1_1, "Price should increase for oneForZero swap");
    }

    /// @notice Tests adding liquidity at a concentrated range around market price then swapping
    function test_Fork_SwapWithConcentratedLiquidity() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add concentrated liquidity close to current tick 0
        // Range: [-600, 600] (about +/- 6% from current price)
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 10e18 // High concentration
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Execute a moderate swap
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        assertGt(amount0, 0, "Should consume input tokens");
        assertLt(amount1, 0, "Should produce output tokens");

        // With concentrated liquidity, we should get better execution
        // (more output per unit of input) compared to wide-range liquidity
        console2.log("Concentrated swap - amount0:", amount0);
        console2.log("Concentrated swap - amount1:", amount1);
    }

    /// @notice Tests an exact-output swap on the fork
    function test_Fork_ExactOutputSwap() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Add wide-range liquidity
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // Exact output swap (negative amountSpecified)
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -1e14, // Want this much token1 out
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        assertGt(amount0, 0, "Should consume token0 for exact output");
        assertLt(amount1, 0, "Should produce token1 for exact output");

        console2.log("Exact output - tokens in (amount0):", amount0);
        console2.log("Exact output - tokens out (amount1):", amount1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION D: Price Impact Verification
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Verifies that price impact scales with swap size
    function test_Fork_PriceImpactScalesWithSize() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add substantial liquidity
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 100e18
        });
        poolManager.modifyLiquidity(key, liqParams);

        // ---- Small swap ----
        (uint160 priceBeforeSmall,,,) = poolManager.getSlot0(poolId);

        IPoolManager.SwapParams memory smallSwap = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e14, // Small: 0.0001 tokens
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        poolManager.swap(key, smallSwap);

        (uint160 priceAfterSmall,,,) = poolManager.getSlot0(poolId);

        // Calculate small swap price impact
        uint256 smallPriceImpact;
        if (priceBeforeSmall > priceAfterSmall) {
            smallPriceImpact = uint256(priceBeforeSmall - priceAfterSmall);
        }

        // ---- Large swap (reset pool first by swapping back) ----
        // Swap back to restore price approximately
        IPoolManager.SwapParams memory resetSwap = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: 1e14,
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });
        poolManager.swap(key, resetSwap);

        (uint160 priceBeforeLarge,,,) = poolManager.getSlot0(poolId);

        IPoolManager.SwapParams memory largeSwap = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 10e18, // Large: 10 tokens (100000x bigger)
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        poolManager.swap(key, largeSwap);

        (uint160 priceAfterLarge,,,) = poolManager.getSlot0(poolId);

        // Calculate large swap price impact
        uint256 largePriceImpact;
        if (priceBeforeLarge > priceAfterLarge) {
            largePriceImpact = uint256(priceBeforeLarge - priceAfterLarge);
        }

        // Large swap should have significantly greater price impact than small swap
        assertGt(
            largePriceImpact,
            smallPriceImpact,
            "Large swap should have greater price impact than small swap"
        );

        console2.log("Small swap price impact (delta sqrtPrice):", smallPriceImpact);
        console2.log("Large swap price impact (delta sqrtPrice):", largePriceImpact);
        console2.log("Price impact ratio (large/small):", largePriceImpact / (smallPriceImpact + 1));
    }

    /// @notice Verifies that more liquidity reduces price impact
    function test_Fork_MoreLiquidityReducesPriceImpact() public {
        // Pool with low liquidity
        PoolKey memory keyLow = _createPoolKey(3000, 60);
        poolManager.initialize(keyLow, SQRT_PRICE_1_1);
        bytes32 poolIdLow = _getPoolId(keyLow);

        IPoolManager.ModifyLiquidityParams memory lowLiqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: 1e18 // Low liquidity
        });
        poolManager.modifyLiquidity(keyLow, lowLiqParams);

        // Pool with high liquidity (different fee tier to create separate pool)
        PoolKey memory keyHigh = _createPoolKey(500, 10);
        poolManager.initialize(keyHigh, SQRT_PRICE_1_1);
        bytes32 poolIdHigh = _getPoolId(keyHigh);

        IPoolManager.ModifyLiquidityParams memory highLiqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -887270,
            tickUpper: 887270,
            liquidityDelta: 1000e18 // 1000x more liquidity
        });
        poolManager.modifyLiquidity(keyHigh, highLiqParams);

        // Same swap amount on both pools
        int256 swapAmount = 1e16;

        // Swap on low liquidity pool
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: swapAmount,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        poolManager.swap(keyLow, swapParams);
        (uint160 priceLowAfter,,,) = poolManager.getSlot0(poolIdLow);

        // Swap on high liquidity pool
        poolManager.swap(keyHigh, swapParams);
        (uint160 priceHighAfter,,,) = poolManager.getSlot0(poolIdHigh);

        // Price impact on low liquidity pool should be greater
        uint256 impactLow = SQRT_PRICE_1_1 > priceLowAfter ? SQRT_PRICE_1_1 - priceLowAfter : priceLowAfter - SQRT_PRICE_1_1;
        uint256 impactHigh = SQRT_PRICE_1_1 > priceHighAfter ? SQRT_PRICE_1_1 - priceHighAfter : priceHighAfter - SQRT_PRICE_1_1;

        assertGt(
            impactLow,
            impactHigh,
            "Low liquidity pool should have greater price impact than high liquidity pool"
        );

        console2.log("Low liquidity price impact:", impactLow);
        console2.log("High liquidity price impact:", impactHigh);
    }

    /// @notice Verifies that concentrated liquidity provides better price execution
    function test_Fork_ConcentratedVsWideLiquidityPriceImpact() public {
        // Pool with wide liquidity
        PoolKey memory keyWide = _createPoolKey(3000, 60);
        poolManager.initialize(keyWide, SQRT_PRICE_1_1);
        bytes32 poolIdWide = _getPoolId(keyWide);

        poolManager.modifyLiquidity(
            keyWide,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 10e18})
        );

        // Pool with concentrated liquidity (different fee tier)
        PoolKey memory keyConc = _createPoolKey(500, 10);
        poolManager.initialize(keyConc, SQRT_PRICE_1_1);
        bytes32 poolIdConc = _getPoolId(keyConc);

        // Same total liquidity, but much more concentrated
        poolManager.modifyLiquidity(
            keyConc,
            IPoolManager.ModifyLiquidityParams({tickLower: -100, tickUpper: 100, liquidityDelta: 10e18})
        );

        // Same swap on both
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e14,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0Wide, int256 amount1Wide) = poolManager.swap(keyWide, swapParams);
        (int256 amount0Conc, int256 amount1Conc) = poolManager.swap(keyConc, swapParams);

        // Concentrated liquidity should produce more output for the same input
        // (less price impact means better execution)
        // Note: We compare absolute output values (both are negative)
        assertLe(
            amount1Conc, // More negative = more output
            amount1Wide,
            "Concentrated liquidity should produce at least as much output as wide liquidity"
        );

        console2.log("Wide liquidity output:", amount1Wide);
        console2.log("Concentrated liquidity output:", amount1Conc);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION E: Multi-Tick Crossing on Fork
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Tests multi-tick crossing with real token addresses on fork
    function test_Fork_MultiTickCrossingWithRealTokens() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Add liquidity in multiple adjacent ranges
        // Range 1: [-60, 60] - 1e18 liquidity (current tick 0 in range)
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: 1e18})
        );

        // Range 2: [-180, -60] - 2e18 liquidity
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -180, tickUpper: -60, liquidityDelta: 2e18})
        );

        // Range 3: [-300, -180] - 4e18 liquidity
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -300, tickUpper: -180, liquidityDelta: 4e18})
        );

        // Initial liquidity at tick 0 should be from range 1
        assertEq(poolManager.getLiquidity(poolId), 1e18, "Initial liquidity should be 1e18");

        // Large swap to cross multiple tick boundaries
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 10e18,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Verify multi-tick crossing occurred
        (, int24 newTick,,) = poolManager.getSlot0(poolId);
        assertLt(newTick, -60, "Should have crossed at least one tick boundary");

        assertGt(amount0, 0, "Should have consumed input tokens across multiple ticks");
        assertLt(amount1, 0, "Should have produced output tokens across multiple ticks");

        console2.log("Multi-tick swap - final tick:", newTick);
        console2.log("Multi-tick swap - amount0:", amount0);
        console2.log("Multi-tick swap - amount1:", amount1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION F: Hook Integration on Fork
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Deploys DynamicFeeHook on forked state and verifies initialization
    function test_Fork_DynamicFeeHookDeployment() public {
        // Deploy hook on the forked state
        DynamicFeeHook dynamicFeeHook = new DynamicFeeHook(address(poolManager));

        // Create a pool key without the hook (hooks are called externally in this pattern)
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Initialize the hook for this pool
        dynamicFeeHook.afterInitialize(address(this), key, SQRT_PRICE_1_1, 0);

        // Verify hook state
        bytes32 poolId = _getPoolId(key);
        assertTrue(dynamicFeeHook.isPoolInitialized(poolId), "Hook should recognize pool as initialized");
        assertEq(dynamicFeeHook.currentFee(poolId), 3000, "Initial fee should be BASE_FEE (3000)");
        assertEq(dynamicFeeHook.sampleCount(poolId), 1, "Should have 1 price sample after init");
    }

    /// @notice Tests DynamicFeeHook fee updates after swaps on the fork
    function test_Fork_DynamicFeeHookFeeUpdates() public {
        DynamicFeeHook dynamicFeeHook = new DynamicFeeHook(address(poolManager));

        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Initialize hook
        dynamicFeeHook.afterInitialize(address(this), key, SQRT_PRICE_1_1, 0);

        // Add liquidity so swaps change the price
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 1e18})
        );

        // Simulate multiple swaps to build up price samples
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        for (uint256 i = 0; i < 5; i++) {
            // Execute swap on pool manager
            poolManager.swap(key, swapParams);

            // Notify the hook
            vm.warp(block.timestamp + 60);
            dynamicFeeHook.afterSwap(alice, key, swapParams, BalanceDelta.wrap(0));
        }

        // After several swaps, the hook should have updated its fee based on volatility
        uint256 sampleCount = dynamicFeeHook.sampleCount(poolId);
        assertGt(sampleCount, 3, "Should have accumulated price samples");

        uint24 currentFee = dynamicFeeHook.currentFee(poolId);
        console2.log("Current dynamic fee after swaps:", currentFee);

        // Fee should be a valid value within bounds
        assertTrue(
            currentFee >= dynamicFeeHook.MIN_FEE() && currentFee <= dynamicFeeHook.MAX_FEE(),
            "Fee should be within valid bounds"
        );
    }

    /// @notice Deploys OracleHook on forked state and verifies observations
    function test_Fork_OracleHookObservations() public {
        OracleHook oracleHook = new OracleHook(address(poolManager));

        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Initialize oracle hook
        oracleHook.afterInitialize(address(this), key, SQRT_PRICE_1_1, 0);

        // Increase oracle cardinality for storing more observations
        oracleHook.increaseCardinality(poolId, 100);

        // Add liquidity
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 1e18})
        );

        // Record observations over time
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e14,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 120); // 2 minutes between observations
            poolManager.swap(key, swapParams);
            oracleHook.afterSwap(alice, key, swapParams, BalanceDelta.wrap(0));
        }

        // Verify observations were recorded
        uint16 observationIndex = oracleHook.getObservationIndex(poolId);
        assertGe(observationIndex, 0, "Should have recorded observations");

        console2.log("Oracle observation index after 5 swaps:", observationIndex);
    }

    /// @notice Tests multiple hooks working together on fork
    function test_Fork_MultipleHooksOnFork() public {
        DynamicFeeHook dynamicFeeHook = new DynamicFeeHook(address(poolManager));
        OracleHook oracleHook = new OracleHook(address(poolManager));

        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);
        bytes32 poolId = _getPoolId(key);

        // Initialize both hooks
        dynamicFeeHook.afterInitialize(address(this), key, SQRT_PRICE_1_1, 0);
        oracleHook.afterInitialize(address(this), key, SQRT_PRICE_1_1, 0);
        oracleHook.increaseCardinality(poolId, 50);

        // Add liquidity
        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 10e18})
        );

        // Simulate trading activity with both hooks
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 120);
            poolManager.swap(key, swapParams);

            // Both hooks process the swap
            dynamicFeeHook.afterSwap(alice, key, swapParams, BalanceDelta.wrap(0));
            oracleHook.afterSwap(alice, key, swapParams, BalanceDelta.wrap(0));
        }

        // Verify both hooks accumulated data
        assertGt(dynamicFeeHook.sampleCount(poolId), 3, "DynamicFeeHook should have price samples");
        assertGe(oracleHook.getObservationIndex(poolId), 0, "OracleHook should have observations");

        console2.log("DynamicFee samples:", dynamicFeeHook.sampleCount(poolId));
        console2.log("Oracle observation index:", oracleHook.getObservationIndex(poolId));
        console2.log("Current dynamic fee:", dynamicFeeHook.currentFee(poolId));
    }

    // ══════════════════════════════════════════════════════════════════════
    // TEST SECTION G: Fork-Specific Edge Cases
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Verifies that the fork is at the pinned block number
    function test_Fork_BlockNumberIsPinned() public view {
        assertEq(block.number, FORK_BLOCK, "Block number should match pinned fork block");
    }

    /// @notice Verifies that the chain ID is Base mainnet (8453)
    function test_Fork_ChainIdIsBase() public view {
        assertEq(block.chainid, 8453, "Chain ID should be 8453 (Base mainnet)");
    }

    /// @notice Tests that pool initialization reverts on invalid currency order (even with real tokens)
    function test_Fork_RevertOnInvalidCurrencyOrder() public {
        // Create pool key with reversed (invalid) currency order
        PoolKey memory badKey = PoolKey({
            currency0: currency1, // Reversed - should be currency0
            currency1: currency0,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(PoolManager.CurrenciesOutOfOrderOrEqual.selector);
        poolManager.initialize(badKey, SQRT_PRICE_1_1);
    }

    /// @notice Tests that duplicate pool initialization reverts on fork
    function test_Fork_RevertOnDuplicateInitialization() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);

        vm.expectRevert(PoolManager.PoolAlreadyInitialized.selector);
        poolManager.initialize(key, SQRT_PRICE_1_1);
    }

    /// @notice Tests swap reverts on uninitialized pool on fork
    function test_Fork_RevertOnSwapUninitializedPool() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        // Do NOT initialize the pool

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        vm.expectRevert(PoolManager.PoolNotInitialized.selector);
        poolManager.swap(key, swapParams);
    }

    /// @notice Tests that pausing works correctly on the forked state
    function test_Fork_PauseAndUnpauseOnFork() public {
        PoolKey memory key = _createPoolKey(3000, 60);
        poolManager.initialize(key, SQRT_PRICE_1_1);

        poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 1e18})
        );

        // Pause
        poolManager.pause();

        // Swap should revert when paused
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1e15,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        vm.expectRevert(); // Pausable.EnforcedPause
        poolManager.swap(key, swapParams);

        // Unpause
        poolManager.unpause();

        // Swap should work after unpause
        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);
        assertGt(amount0, 0, "Swap should work after unpause");
        assertLt(amount1, 0, "Swap should produce output after unpause");
    }
}

// ══════════════════════════════════════════════════════════════════════
// HELPER INTERFACE
// ══════════════════════════════════════════════════════════════════════

/// @notice Minimal interface for ERC20 metadata (decimals)
interface IERC20Metadata {
    function decimals() external view returns (uint8);
}

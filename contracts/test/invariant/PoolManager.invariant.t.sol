// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {IPoolManager} from "../../src/interfaces/IPoolManager.sol";
import {PoolKey} from "../../src/types/PoolKey.sol";
import {Currency} from "../../src/types/Currency.sol";
import {IHooks} from "../../src/interfaces/IHooks.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @title PoolManagerInvariantHandler
/// @notice Handler contract for invariant testing
contract PoolManagerInvariantHandler is Test {
    PoolManager public poolManager;
    PoolKey public testPool;
    bytes32 public poolId;

    uint256 public totalLiquidityAdded;
    uint256 public totalLiquidityRemoved;
    uint256 public swapCount;

    constructor(PoolManager _poolManager, PoolKey memory _testPool) {
        poolManager = _poolManager;
        testPool = _testPool;
        poolId = keccak256(abi.encode(_testPool));
    }

    /// @notice Add liquidity with random valid parameters
    function addLiquidity(uint256 amount, int24 tickLowerOffset, int24 tickUpperOffset) public {
        // Bound amounts and ticks
        amount = bound(amount, 1e18, 1e27);
        tickLowerOffset = int24(int256(bound(uint256(int256(tickLowerOffset)), 0, 1000)));
        tickUpperOffset = int24(int256(bound(uint256(int256(tickUpperOffset)), 1001, 2000)));

        int24 tickLower = -int24(tickLowerOffset * 60);
        int24 tickUpper = int24(tickUpperOffset * 60);

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(amount)
        });

        try poolManager.modifyLiquidity(testPool, params) {
            totalLiquidityAdded += amount;
        } catch {
            // Ignore reverts
        }
    }

    /// @notice Remove liquidity with random valid parameters
    function removeLiquidity(uint256 amount, int24 tickLowerOffset, int24 tickUpperOffset) public {
        amount = bound(amount, 1e18, 1e27);
        tickLowerOffset = int24(int256(bound(uint256(int256(tickLowerOffset)), 0, 1000)));
        tickUpperOffset = int24(int256(bound(uint256(int256(tickUpperOffset)), 1001, 2000)));

        int24 tickLower = -int24(tickLowerOffset * 60);
        int24 tickUpper = int24(tickUpperOffset * 60);

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: -int256(amount)
        });

        try poolManager.modifyLiquidity(testPool, params) {
            totalLiquidityRemoved += amount;
        } catch {
            // Ignore reverts (e.g., insufficient liquidity)
        }
    }

    /// @notice Perform swap with random parameters
    function swap(uint256 amount, bool zeroForOne) public {
        amount = bound(amount, 1e15, 1e20);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: int256(amount),
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });

        try poolManager.swap(testPool, params) {
            swapCount++;
        } catch {
            // Ignore reverts (e.g., insufficient liquidity)
        }
    }
}

/// @title PoolManagerInvariantTest
/// @notice Invariant tests for PoolManager
/// @dev Tests protocol invariants with 1,000+ runs
contract PoolManagerInvariantTest is StdInvariant, Test {
    PoolManager public poolManager;
    PoolManagerInvariantHandler public handler;
    MockERC20 public token0;
    MockERC20 public token1;
    Currency public currency0;
    Currency public currency1;
    PoolKey public testPool;
    bytes32 public poolId;

    function setUp() public {
        poolManager = new PoolManager();
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        testPool = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        poolManager.initialize(testPool, TickMath.getSqrtPriceAtTick(0));
        poolId = keccak256(abi.encode(testPool));

        // Add initial liquidity
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 1e24
        });
        poolManager.modifyLiquidity(testPool, params);

        // Create and target handler
        handler = new PoolManagerInvariantHandler(poolManager, testPool);
        targetContract(address(handler));
    }

    // ══════════════════════════════════════════════════════════════════════
    // INVARIANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Invariant: Pool liquidity should never be negative
    function invariant_LiquidityNeverNegative() public {
        uint128 liquidity = poolManager.getLiquidity(poolId);
        assertGe(liquidity, 0, "INVARIANT VIOLATED: Liquidity is negative");
    }

    /// @notice Invariant: Pool sqrt price should always be within valid range
    function invariant_SqrtPriceWithinBounds() public {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        if (sqrtPriceX96 > 0) {
            assertGe(sqrtPriceX96, TickMath.MIN_SQRT_PRICE, "INVARIANT VIOLATED: Sqrt price below minimum");
            assertLe(sqrtPriceX96, TickMath.MAX_SQRT_PRICE, "INVARIANT VIOLATED: Sqrt price above maximum");
        }
    }

    /// @notice Invariant: Pool tick should always be within valid range
    function invariant_TickWithinBounds() public {
        (, int24 tick,,) = poolManager.getSlot0(poolId);

        assertGe(tick, TickMath.MIN_TICK, "INVARIANT VIOLATED: Tick below minimum");
        assertLe(tick, TickMath.MAX_TICK, "INVARIANT VIOLATED: Tick above maximum");
    }

    /// @notice Invariant: Sqrt price and tick should be consistent
    function invariant_SqrtPriceAndTickConsistent() public {
        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);

        if (sqrtPriceX96 > 0) {
            uint160 expectedSqrtPrice = TickMath.getSqrtPriceAtTick(tick);
            int24 expectedTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

            // Allow small tolerance due to rounding
            assertApproxEqAbs(
                uint256(sqrtPriceX96),
                uint256(expectedSqrtPrice),
                uint256(expectedSqrtPrice) / 1000, // 0.1% tolerance
                "INVARIANT VIOLATED: Sqrt price and tick inconsistent"
            );

            assertApproxEqAbs(
                uint256(int256(tick)),
                uint256(int256(expectedTick)),
                1,
                "INVARIANT VIOLATED: Tick and sqrt price inconsistent"
            );
        }
    }

    /// @notice Invariant: Fee should always be within reasonable bounds
    function invariant_FeeWithinBounds() public {
        (,, uint16 protocolFee, uint24 lpFee) = poolManager.getSlot0(poolId);

        assertLe(protocolFee, 10000, "INVARIANT VIOLATED: Protocol fee too high (>100%)");
        assertLe(lpFee, 100000, "INVARIANT VIOLATED: LP fee too high (>10%)");
    }

    /// @notice Invariant: Liquidity accounting should be consistent
    function invariant_LiquidityAccountingConsistent() public {
        uint128 currentLiquidity = poolManager.getLiquidity(poolId);

        // Current liquidity should be <= total added
        // (because some might have been removed)
        assertLe(
            uint256(currentLiquidity),
            handler.totalLiquidityAdded() + 1e24, // +1e24 for initial liquidity
            "INVARIANT VIOLATED: Current liquidity exceeds total added"
        );
    }

    /// @notice Invariant: Pool should remain initialized
    function invariant_PoolRemainsInitialized() public {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        assertGt(sqrtPriceX96, 0, "INVARIANT VIOLATED: Pool became uninitialized");
    }

    /// @notice Invariant: Handler state should be reasonable
    function invariant_HandlerStateReasonable() public {
        assertGe(handler.totalLiquidityAdded(), 0, "INVARIANT VIOLATED: Total liquidity added is negative");
        assertGe(handler.totalLiquidityRemoved(), 0, "INVARIANT VIOLATED: Total liquidity removed is negative");
        assertGe(handler.swapCount(), 0, "INVARIANT VIOLATED: Swap count is negative");

        // Total removed should never exceed total added
        assertLe(
            handler.totalLiquidityRemoved(),
            handler.totalLiquidityAdded() + 1e24, // +1e24 for initial liquidity
            "INVARIANT VIOLATED: Total removed exceeds total added"
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // CALL SUMMARY
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Print call summary after invariant testing
    function invariant_CallSummary() public view {
        console.log("\n=== INVARIANT TEST CALL SUMMARY ===");
        console.log("Total Liquidity Added:    ", handler.totalLiquidityAdded());
        console.log("Total Liquidity Removed:  ", handler.totalLiquidityRemoved());
        console.log("Swap Count:               ", handler.swapCount());

        (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);

        console.log("\n=== FINAL POOL STATE ===");
        console.log("Sqrt Price X96:           ", sqrtPriceX96);
        console.log("Tick:                     ", uint256(int256(tick)));
        console.log("Liquidity:                ", liquidity);
        console.log("Protocol Fee:             ", protocolFee);
        console.log("LP Fee:                   ", lpFee);
        console.log("===================================\n");
    }
}

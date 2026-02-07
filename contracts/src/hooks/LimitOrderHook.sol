// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./BaseHook.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {SqrtPriceMath} from "../libraries/SqrtPriceMath.sol";
import {SwapMath} from "../libraries/SwapMath.sol";
import {FullMath} from "../libraries/FullMath.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title LimitOrderHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that enables on-chain limit orders for pools
/// @dev Orders are placed at specific ticks and automatically executed when price crosses
contract LimitOrderHook is BaseHook, Ownable2Step {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error OrderNotFound();
    error OrderAlreadyFilled();
    error OrderAlreadyCancelled();
    error Unauthorized();
    error InvalidTick();
    error InvalidAmount();
    error InsufficientBalance();
    error ClaimFailed();
    error TickOrderLimitReached();

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Limit order structure
    struct Order {
        address owner; // Order creator
        bytes32 poolId; // Pool identifier
        bool zeroForOne; // Direction: true = sell token0 for token1
        int24 tick; // Target tick (price)
        uint128 amountIn; // Amount to sell
        uint128 amountOutMinimum; // Minimum amount to receive
        uint128 amountFilled; // Amount already filled
        uint32 deadline; // Order expiration timestamp
        OrderStatus status; // Current order status
    }

    /// @notice Order status
    enum OrderStatus {
        Open, // Order is active
        PartiallyFilled, // Order is partially executed
        Filled, // Order is fully executed
        Cancelled, // Order was cancelled
        Expired // Order passed deadline
    }

    /// @notice Claimable amounts for filled orders
    struct ClaimableAmount {
        uint128 amount0; // Claimable token0
        uint128 amount1; // Claimable token1
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Maximum number of orders allowed per tick per pool
    uint256 public constant MAX_ORDERS_PER_TICK = 200;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Order ID counter
    uint256 public nextOrderId;

    /// @notice All orders by ID
    mapping(uint256 => Order) public orders;

    /// @notice Claimable amounts by order ID
    mapping(uint256 => ClaimableAmount) public claimable;

    /// @notice User orders: user => orderId[]
    mapping(address => uint256[]) public userOrders;

    /// @notice Pool orders: poolId => tick => orderId[]
    /// @dev Orders at specific tick levels for efficient lookup
    mapping(bytes32 => mapping(int24 => uint256[])) public poolTickOrders;

    /// @notice Pool initialization status
    mapping(bytes32 => bool) public isPoolInitialized;

    /// @notice Pool keys by poolId for token transfer operations
    mapping(bytes32 => PoolKey) internal poolKeys;

    /// @notice Fee charged on order execution (in basis points)
    /// @dev 30 = 0.3%
    uint24 public executionFee = 30;

    /// @notice Protocol fee collector
    address public feeCollector;

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        bytes32 indexed poolId,
        bool zeroForOne,
        int24 tick,
        uint128 amountIn,
        uint128 amountOutMinimum,
        uint32 deadline
    );

    event OrderFilled(
        uint256 indexed orderId, uint128 amountIn, uint128 amountOut, uint128 amountFilled, OrderStatus status
    );

    event OrderCancelled(uint256 indexed orderId);

    event OrderClaimed(uint256 indexed orderId, address indexed owner, uint128 amount0, uint128 amount1);

    event ExecutionFeeUpdated(uint24 oldFee, uint24 newFee);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        feeCollector = msg.sender;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK PERMISSIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the hook permissions
    function getHookPermissions() external pure override returns (Permissions memory) {
        return Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeModifyLiquidity: false,
            afterModifyLiquidity: false,
            beforeSwap: true,
            afterSwap: true
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Called after pool initialization
    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));
        isPoolInitialized[poolId] = true;

        // Store the pool key for token transfer operations
        poolKeys[poolId] = key;

        return IHooks.afterInitialize.selector;
    }

    /// @notice Called before a swap
    /// @dev Checks if any limit orders can be filled
    function beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata params)
        external
        view
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Get current tick
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);

        // Check for fillable orders at current price
        // In production, this would trigger order execution
        _checkFillableOrders(poolId, currentTick, params.zeroForOne);

        return IHooks.beforeSwap.selector;
    }

    /// @notice Called after a swap
    /// @dev Attempts to fill limit orders at the new price
    function afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata params, BalanceDelta)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Get new tick after swap
        (, int24 newTick,,) = poolManager.getSlot0(poolId);

        // Try to fill orders at new price
        _executeFillableOrders(poolId, newTick, params.zeroForOne);

        return IHooks.afterSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORDER MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Place a limit order
    /// @param poolKey Pool to place order in
    /// @param zeroForOne Direction of trade
    /// @param tick Target price tick
    /// @param amountIn Amount to sell
    /// @param amountOutMinimum Minimum amount to receive
    /// @param deadline Order expiration time
    /// @return orderId The ID of the created order
    function placeOrder(
        PoolKey calldata poolKey,
        bool zeroForOne,
        int24 tick,
        uint128 amountIn,
        uint128 amountOutMinimum,
        uint32 deadline
    ) external payable returns (uint256 orderId) {
        bytes32 poolId = keccak256(abi.encode(poolKey));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();
        if (amountIn == 0) revert InvalidAmount();
        if (tick < TickMath.MIN_TICK || tick > TickMath.MAX_TICK) revert InvalidTick();
        if (deadline <= block.timestamp) revert InvalidAmount();

        // Enforce MAX_ORDERS_PER_TICK to prevent unbounded array growth
        if (poolTickOrders[poolId][tick].length >= MAX_ORDERS_PER_TICK) {
            revert TickOrderLimitReached();
        }

        // Create order
        orderId = nextOrderId++;

        orders[orderId] = Order({
            owner: msg.sender,
            poolId: poolId,
            zeroForOne: zeroForOne,
            tick: tick,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            amountFilled: 0,
            deadline: deadline,
            status: OrderStatus.Open
        });

        // Track order
        userOrders[msg.sender].push(orderId);
        poolTickOrders[poolId][tick].push(orderId);

        // Transfer tokens from user (requires approval)
        // If zeroForOne, user is selling token0; otherwise selling token1
        Currency tokenIn = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        _transferFrom(tokenIn, msg.sender, address(this), amountIn);

        emit OrderPlaced(orderId, msg.sender, poolId, zeroForOne, tick, amountIn, amountOutMinimum, deadline);
    }

    /// @notice Cancel an open order
    /// @param orderId Order to cancel
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert Unauthorized();
        if (order.status == OrderStatus.Filled) revert OrderAlreadyFilled();
        if (order.status == OrderStatus.Cancelled) revert OrderAlreadyCancelled();

        // Update status
        order.status = OrderStatus.Cancelled;

        // Return unfilled amount to user
        uint128 unfilledAmount = order.amountIn - order.amountFilled;
        if (unfilledAmount > 0) {
            // Get the pool key to determine which token to return
            PoolKey storage poolKey = poolKeys[order.poolId];

            // Transfer the unfilled input tokens back to user
            // If zeroForOne, user was selling token0; otherwise selling token1
            Currency tokenIn = order.zeroForOne ? poolKey.currency0 : poolKey.currency1;
            _transfer(tokenIn, msg.sender, unfilledAmount);
        }

        emit OrderCancelled(orderId);
    }

    /// @notice Claim filled order proceeds
    /// @param orderId Order to claim
    function claimOrder(uint256 orderId) external {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert Unauthorized();
        if (order.status != OrderStatus.Filled && order.status != OrderStatus.PartiallyFilled) {
            revert OrderNotFound();
        }

        ClaimableAmount memory claimAmount = claimable[orderId];

        if (claimAmount.amount0 == 0 && claimAmount.amount1 == 0) revert ClaimFailed();

        // Reset claimable
        delete claimable[orderId];

        // Get the pool key to access token addresses
        PoolKey storage poolKey = poolKeys[order.poolId];

        // Transfer tokens to user
        if (claimAmount.amount0 > 0) {
            _transfer(poolKey.currency0, msg.sender, claimAmount.amount0);
        }
        if (claimAmount.amount1 > 0) {
            _transfer(poolKey.currency1, msg.sender, claimAmount.amount1);
        }

        emit OrderClaimed(orderId, msg.sender, claimAmount.amount0, claimAmount.amount1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Check for fillable orders (view only)
    function _checkFillableOrders(bytes32 poolId, int24 currentTick, bool swapDirection) internal view {
        // Get orders at current tick
        uint256[] storage orderIds = poolTickOrders[poolId][currentTick];

        for (uint256 i = 0; i < orderIds.length; i++) {
            uint256 orderId = orderIds[i];
            Order storage order = orders[orderId];

            // Skip if not open or expired
            if (order.status != OrderStatus.Open && order.status != OrderStatus.PartiallyFilled) {
                continue;
            }

            if (block.timestamp > order.deadline) {
                continue;
            }

            // Check if order direction matches potential fill
            // If swap is zeroForOne (selling token0), can fill buy orders (buying token0)
            bool canFill = order.zeroForOne != swapDirection;

            if (canFill) {
                // Order can potentially be filled
                // In production, this would calculate exact fill amounts
            }
        }
    }

    /// @notice Execute fillable orders after a swap moves the price
    /// @dev Iterates through orders at the order tick and fills those whose target has been crossed
    /// @param poolId The pool ID
    /// @param currentTick The current tick after the swap
    /// @param swapDirection The direction of the swap that occurred
    function _executeFillableOrders(bytes32 poolId, int24 currentTick, bool swapDirection) internal {
        // Get orders at current tick
        uint256[] storage orderIds = poolTickOrders[poolId][currentTick];

        for (uint256 i = 0; i < orderIds.length; i++) {
            uint256 orderId = orderIds[i];
            Order storage order = orders[orderId];

            // Skip if not fillable
            if (order.status != OrderStatus.Open && order.status != OrderStatus.PartiallyFilled) {
                continue;
            }

            // Check expiration
            if (block.timestamp > order.deadline) {
                order.status = OrderStatus.Expired;
                continue;
            }

            // Check if order can be filled:
            // The order's tick has been reached/crossed by the swap.
            // - For zeroForOne orders (selling token0 for token1): price should have dropped
            //   to or below the target tick, so currentTick <= order.tick
            // - For oneForZero orders (selling token1 for token0): price should have risen
            //   to or above the target tick, so currentTick >= order.tick
            // Additionally, the swap direction must be opposite to the order direction
            // (a zeroForOne swap fills oneForZero limit orders and vice versa)
            bool canFill = _canFillOrder(order, currentTick, swapDirection);

            if (canFill) {
                _fillOrder(orderId, poolId);
            }
        }
    }

    /// @notice Check if an order can be filled given the current tick and swap direction
    /// @param order The order to check
    /// @param currentTick The current pool tick
    /// @param swapDirection The direction of the swap that occurred
    /// @return Whether the order can be filled
    function _canFillOrder(Order storage order, int24 currentTick, bool swapDirection) internal view returns (bool) {
        // Swap direction must be opposite to order direction for a fill to occur
        if (order.zeroForOne == swapDirection) return false;

        // Check that the price has crossed the order's target tick:
        // - zeroForOne order (sell token0, buy token1): wants price to drop => currentTick <= order.tick
        // - oneForZero order (sell token1, buy token0): wants price to rise => currentTick >= order.tick
        if (order.zeroForOne) {
            return currentTick <= order.tick;
        } else {
            return currentTick >= order.tick;
        }
    }

    /// @notice Fill an order using proper CLMM math
    /// @dev Uses SwapMath.computeSwapStep to compute accurate output amounts
    /// @param orderId The order ID to fill
    /// @param poolId The pool ID for liquidity lookup
    function _fillOrder(uint256 orderId, bytes32 poolId) internal {
        Order storage order = orders[orderId];

        // Calculate remaining fill amount
        uint128 amountToFill = order.amountIn - order.amountFilled;

        // Get pool liquidity for swap computation
        uint128 poolLiquidity = poolManager.getLiquidity(poolId);

        // Calculate output amount using proper CLMM math
        (uint128 amountIn, uint128 amountOut) = _calculateSwapAmounts(order, amountToFill, poolLiquidity);

        // If we can't fill anything, skip
        if (amountIn == 0 || amountOut == 0) {
            return;
        }

        // Deduct execution fee from the output
        uint128 feeAmount = uint128(FullMath.mulDiv(uint256(amountOut), uint256(executionFee), 10000));
        uint128 netAmountOut = amountOut - feeAmount;

        // Check slippage against the proportional minimum
        // For partial fills, scale the minimum proportionally
        uint128 proportionalMinimum;
        if (amountIn == amountToFill) {
            // Full fill: use the remaining minimum (total minimum minus what was already received)
            proportionalMinimum = order.amountOutMinimum;
        } else {
            // Partial fill: scale the minimum by the fraction being filled
            proportionalMinimum = uint128(
                FullMath.mulDiv(uint256(order.amountOutMinimum), uint256(amountIn), uint256(order.amountIn))
            );
        }

        if (netAmountOut < proportionalMinimum) {
            return; // Skip if slippage too high
        }

        // Update order state
        order.amountFilled += amountIn;

        if (order.amountFilled == order.amountIn) {
            order.status = OrderStatus.Filled;
        } else {
            order.status = OrderStatus.PartiallyFilled;
        }

        // Update claimable amounts
        if (order.zeroForOne) {
            // Selling token0 for token1: output is token1
            claimable[orderId].amount1 += netAmountOut;
        } else {
            // Selling token1 for token0: output is token0
            claimable[orderId].amount0 += netAmountOut;
        }

        emit OrderFilled(orderId, amountIn, netAmountOut, order.amountFilled, order.status);
    }

    /// @notice Calculate swap amounts using proper CLMM SqrtPriceMath
    /// @dev Uses SqrtPriceMath.getAmount0Delta/getAmount1Delta for accurate conversion
    /// at the order's target tick price. For limit orders, we compute the output amount
    /// based on the order's tick price, which represents the execution price.
    /// @param order The order to calculate for
    /// @param amountIn The input amount to convert
    /// @param poolLiquidity The pool's current liquidity (used for partial fill capacity)
    /// @return filledIn The actual amount of input consumed
    /// @return filledOut The output amount produced
    function _calculateSwapAmounts(Order storage order, uint128 amountIn, uint128 poolLiquidity)
        internal
        view
        returns (uint128 filledIn, uint128 filledOut)
    {
        // Get the sqrt price at the order's target tick
        uint160 sqrtPriceAtTick = TickMath.getSqrtPriceAtTick(order.tick);

        // Get the current pool price
        (uint160 sqrtPriceCurrentX96,,,) = poolManager.getSlot0(order.poolId);

        // If pool has no liquidity, use direct price conversion at the order tick
        if (poolLiquidity == 0) {
            filledIn = amountIn;
            filledOut = _convertAtPrice(sqrtPriceAtTick, amountIn, order.zeroForOne);
            return (filledIn, filledOut);
        }

        // Use SwapMath.computeSwapStep for accurate computation
        // This computes how much output we get for a given input,
        // constrained by the price movement from current to target
        (uint160 sqrtPriceNextX96, uint256 swapAmountIn, uint256 swapAmountOut,) = SwapMath.computeSwapStep(
            sqrtPriceCurrentX96,
            sqrtPriceAtTick,
            poolLiquidity,
            int256(uint256(amountIn)), // exactIn: positive amountRemaining
            0 // No fee within the swap step; we apply our own execution fee separately
        );

        // If the swap step consumed less than the full amount (partial fill),
        // use what was actually consumed. Otherwise, use full amount.
        if (swapAmountIn < uint256(amountIn)) {
            filledIn = uint128(swapAmountIn);
        } else {
            filledIn = amountIn;
        }

        filledOut = uint128(swapAmountOut);

        // If computeSwapStep returns zero output (e.g., prices are equal),
        // fall back to direct price conversion at the order tick
        if (filledOut == 0 && filledIn > 0) {
            filledOut = _convertAtPrice(sqrtPriceAtTick, filledIn, order.zeroForOne);
        }

        // Safety: if sqrtPriceNextX96 == sqrtPriceCurrentX96, the prices haven't moved,
        // meaning no swap occurred in the pool step. Use price-based conversion.
        if (sqrtPriceNextX96 == sqrtPriceCurrentX96 && filledOut == 0) {
            filledIn = amountIn;
            filledOut = _convertAtPrice(sqrtPriceAtTick, amountIn, order.zeroForOne);
        }
    }

    /// @notice Convert an amount at a specific sqrt price using proper Q64.96 math
    /// @dev Uses FullMath.mulDiv for overflow-safe 256-bit arithmetic
    /// price = (sqrtPriceX96)^2 / 2^192 = token1/token0
    /// For zeroForOne (selling token0): amountOut = amountIn * price
    /// For oneForZero (selling token1): amountOut = amountIn / price
    /// @param sqrtPriceX96 The sqrt price in Q64.96 format
    /// @param amountIn The input amount
    /// @param zeroForOne The swap direction
    /// @return amountOut The computed output amount
    function _convertAtPrice(uint160 sqrtPriceX96, uint128 amountIn, bool zeroForOne)
        internal
        pure
        returns (uint128 amountOut)
    {
        if (zeroForOne) {
            // Selling token0 for token1
            // amountOut = amountIn * (sqrtPrice^2 / 2^192)
            // = amountIn * sqrtPrice * sqrtPrice / 2^192
            // Use two-step FullMath to avoid overflow
            uint256 intermediate = FullMath.mulDiv(uint256(amountIn), uint256(sqrtPriceX96), 1 << 96);
            amountOut = uint128(FullMath.mulDiv(intermediate, uint256(sqrtPriceX96), 1 << 96));
        } else {
            // Selling token1 for token0
            // amountOut = amountIn / (sqrtPrice^2 / 2^192)
            // = amountIn * 2^192 / (sqrtPrice^2)
            // = amountIn * (2^96 / sqrtPrice) * (2^96 / sqrtPrice)
            // Use two-step FullMath to avoid overflow
            uint256 intermediate = FullMath.mulDiv(uint256(amountIn), 1 << 96, uint256(sqrtPriceX96));
            amountOut = uint128(FullMath.mulDiv(intermediate, 1 << 96, uint256(sqrtPriceX96)));
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get order details
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /// @notice Get user's orders
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /// @notice Get orders at specific tick
    function getPoolTickOrders(bytes32 poolId, int24 tick) external view returns (uint256[] memory) {
        return poolTickOrders[poolId][tick];
    }

    /// @notice Get claimable amount for order
    function getClaimable(uint256 orderId) external view returns (ClaimableAmount memory) {
        return claimable[orderId];
    }

    /// @notice Check if order is fillable at current price
    /// @dev An order is fillable when the current pool price has crossed the order's target tick:
    ///   - zeroForOne orders (sell token0): fillable when currentTick <= order.tick (price dropped to target)
    ///   - oneForZero orders (sell token1): fillable when currentTick >= order.tick (price rose to target)
    function isFillable(uint256 orderId) external view returns (bool) {
        Order storage order = orders[orderId];

        if (order.status != OrderStatus.Open && order.status != OrderStatus.PartiallyFilled) {
            return false;
        }

        if (block.timestamp > order.deadline) {
            return false;
        }

        // Get current tick
        (, int24 currentTick,,) = poolManager.getSlot0(order.poolId);

        // Check if current price has crossed the order's target tick
        if (order.zeroForOne) {
            // Selling token0 for token1: order fills when price drops to or below target
            return currentTick <= order.tick;
        } else {
            // Selling token1 for token0: order fills when price rises to or above target
            return currentTick >= order.tick;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Update execution fee
    function setExecutionFee(uint24 newFee) external onlyOwner {
        if (newFee > 1000) revert InvalidAmount(); // Max 10%

        uint24 oldFee = executionFee;
        executionFee = newFee;

        emit ExecutionFeeUpdated(oldFee, newFee);
    }

    /// @notice Update fee collector
    function setFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) revert InvalidAmount();

        feeCollector = newCollector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // CLEANUP FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Remove filled, cancelled, and expired orders from a tick's order array to free slots
    /// @dev Can be called by anyone to reclaim capacity at a tick
    /// @param poolId The pool identifier
    /// @param tick The tick to clean up
    /// @return removed The number of order entries removed
    function cleanupTickOrders(bytes32 poolId, int24 tick) external returns (uint256 removed) {
        uint256[] storage orderIds = poolTickOrders[poolId][tick];
        uint256 writeIndex = 0;

        for (uint256 readIndex = 0; readIndex < orderIds.length; readIndex++) {
            Order storage order = orders[orderIds[readIndex]];

            // Mark expired orders
            if ((order.status == OrderStatus.Open || order.status == OrderStatus.PartiallyFilled)
                && block.timestamp > order.deadline) {
                order.status = OrderStatus.Expired;
            }

            // Keep only open and partially filled orders
            if (order.status == OrderStatus.Open || order.status == OrderStatus.PartiallyFilled) {
                if (writeIndex != readIndex) {
                    orderIds[writeIndex] = orderIds[readIndex];
                }
                writeIndex++;
            }
        }

        removed = orderIds.length - writeIndex;

        // Pop excess entries from the end
        for (uint256 i = 0; i < removed; i++) {
            orderIds.pop();
        }
    }

    /// @notice Get the number of active orders at a specific tick
    /// @param poolId The pool identifier
    /// @param tick The tick to query
    /// @return count The number of order entries at this tick
    function getTickOrderCount(bytes32 poolId, int24 tick) external view returns (uint256) {
        return poolTickOrders[poolId][tick].length;
    }

    // ══════════════════════════════════════════════════════════════════════
    // TOKEN TRANSFER HELPERS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Transfer tokens from a user to this contract (requires approval)
    /// @param currency The currency to transfer
    /// @param from The address to transfer from
    /// @param to The address to transfer to
    /// @param amount The amount to transfer
    function _transferFrom(Currency currency, address from, address to, uint256 amount) internal {
        if (currency.isNative()) {
            // Native ETH - should be sent with the transaction
            if (from == msg.sender) {
                require(msg.value >= amount, "Insufficient ETH sent");
                if (to != address(this)) {
                    (bool success,) = to.call{value: amount}("");
                    require(success, "ETH transfer failed");
                }
            }
        } else {
            // ERC20 transfer
            IERC20(Currency.unwrap(currency)).safeTransferFrom(from, to, amount);
        }
    }

    /// @notice Transfer tokens from this contract to a recipient
    /// @param currency The currency to transfer
    /// @param to The address to transfer to
    /// @param amount The amount to transfer
    function _transfer(Currency currency, address to, uint256 amount) internal {
        if (currency.isNative()) {
            // Native ETH
            (bool success,) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 transfer
            IERC20(Currency.unwrap(currency)).safeTransfer(to, amount);
        }
    }

    /// @notice Get the pool key for a pool ID
    /// @param poolId The pool ID
    /// @return The pool key
    function getPoolKey(bytes32 poolId) external view returns (PoolKey memory) {
        return poolKeys[poolId];
    }

    /// @notice Receive ETH for native token orders
    receive() external payable {}
}

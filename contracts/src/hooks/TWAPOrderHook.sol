// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./BaseHook.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {FullMath} from "../libraries/FullMath.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title TWAPOrderHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that executes large orders over time using TWAP strategy
/// @dev Splits large orders into smaller chunks executed at intervals to minimize slippage
contract TWAPOrderHook is BaseHook, Ownable2Step {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error OrderNotFound();
    error OrderAlreadyCompleted();
    error OrderAlreadyCancelled();
    error OrderNotOwned();
    error InvalidAmount();
    error InvalidTimeWindow();
    error InvalidNumberOfExecutions();
    error OrderExpired();
    error TooEarlyToExecute();
    error SlippageExceeded();
    error TransferFailed();

    // ══════════════════════════════════════════════════════════════════════
    // ENUMS
    // ══════════════════════════════════════════════════════════════════════

    enum OrderStatus {
        Active,      // Order is active and executing
        Completed,   // Order fully executed
        Cancelled,   // Order cancelled by user
        Expired      // Order expired
    }

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice TWAP order structure
    struct TWAPOrder {
        address owner;              // Order creator
        bytes32 poolId;             // Pool identifier
        bool zeroForOne;            // Swap direction
        uint256 totalAmount;        // Total amount to swap
        uint256 executedAmount;     // Amount already executed
        uint256 numberOfExecutions; // Total number of executions
        uint256 executionInterval;  // Time between executions (seconds)
        uint256 lastExecutionTime;  // Last execution timestamp
        uint256 deadline;           // Order expiration
        uint256 minAmountPerExecution; // Minimum amount per execution (slippage protection)
        OrderStatus status;         // Current status
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Minimum execution interval (1 minute)
    uint256 public constant MIN_EXECUTION_INTERVAL = 60;

    /// @notice Maximum execution interval (1 day)
    uint256 public constant MAX_EXECUTION_INTERVAL = 86400;

    /// @notice Minimum number of executions
    uint256 public constant MIN_EXECUTIONS = 2;

    /// @notice Maximum number of executions
    uint256 public constant MAX_EXECUTIONS = 100;

    /// @notice Execution fee (basis points, 0.1% = 10)
    uint256 public constant EXECUTION_FEE_BPS = 10;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Pool initialization status
    mapping(bytes32 => bool) public isPoolInitialized;

    /// @notice Pool keys by poolId for token transfer operations
    mapping(bytes32 => PoolKey) public poolKeys;

    /// @notice TWAP orders
    mapping(uint256 => TWAPOrder) public orders;

    /// @notice Next order ID
    uint256 public nextOrderId;

    /// @notice User orders (user => orderId[])
    mapping(address => uint256[]) public userOrders;

    /// @notice Pool active orders (poolId => orderId[])
    mapping(bytes32 => uint256[]) public poolOrders;

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event OrderCreated(
        uint256 indexed orderId,
        address indexed owner,
        bytes32 indexed poolId,
        bool zeroForOne,
        uint256 totalAmount,
        uint256 numberOfExecutions,
        uint256 executionInterval
    );

    event OrderExecuted(
        uint256 indexed orderId,
        uint256 executionNumber,
        uint256 amountExecuted,
        uint256 amountReceived
    );

    event OrderCompleted(uint256 indexed orderId, uint256 totalExecuted);
    event OrderCancelled(uint256 indexed orderId, uint256 remainingAmount);
    event OrderExpiredEvent(uint256 indexed orderId);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        feeCollector = msg.sender;
        nextOrderId = 1;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK PERMISSIONS
    // ══════════════════════════════════════════════════════════════════════

    function getHookPermissions() external pure override returns (Permissions memory) {
        return Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeModifyLiquidity: false,
            afterModifyLiquidity: false,
            beforeSwap: true,
            afterSwap: false
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS
    // ══════════════════════════════════════════════════════════════════════

    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));
        isPoolInitialized[poolId] = true;
        poolKeys[poolId] = key;
        return IHooks.afterInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata)
        external
        view
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));
        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();
        return IHooks.beforeSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // TWAP ORDER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Create a new TWAP order
    /// @param poolKey Pool to trade on
    /// @param zeroForOne Swap direction
    /// @param totalAmount Total amount to swap
    /// @param numberOfExecutions Number of executions to split order into
    /// @param executionInterval Time between executions (seconds)
    /// @param minAmountPerExecution Minimum amount to receive per execution
    /// @param deadline Order expiration timestamp
    /// @return orderId The created order ID
    function createTWAPOrder(
        PoolKey calldata poolKey,
        bool zeroForOne,
        uint256 totalAmount,
        uint256 numberOfExecutions,
        uint256 executionInterval,
        uint256 minAmountPerExecution,
        uint256 deadline
    ) external returns (uint256 orderId) {
        bytes32 poolId = keccak256(abi.encode(poolKey));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();
        if (totalAmount == 0) revert InvalidAmount();
        if (numberOfExecutions < MIN_EXECUTIONS || numberOfExecutions > MAX_EXECUTIONS) {
            revert InvalidNumberOfExecutions();
        }
        if (executionInterval < MIN_EXECUTION_INTERVAL || executionInterval > MAX_EXECUTION_INTERVAL) {
            revert InvalidTimeWindow();
        }
        if (deadline <= block.timestamp) revert OrderExpired();

        orderId = nextOrderId++;

        orders[orderId] = TWAPOrder({
            owner: msg.sender,
            poolId: poolId,
            zeroForOne: zeroForOne,
            totalAmount: totalAmount,
            executedAmount: 0,
            numberOfExecutions: numberOfExecutions,
            executionInterval: executionInterval,
            lastExecutionTime: block.timestamp,
            deadline: deadline,
            minAmountPerExecution: minAmountPerExecution,
            status: OrderStatus.Active
        });

        userOrders[msg.sender].push(orderId);
        poolOrders[poolId].push(orderId);

        // Transfer input tokens from user to this contract (escrow)
        // If zeroForOne, input token is currency0; otherwise input token is currency1
        Currency inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        IERC20(inputCurrency.toAddress()).safeTransferFrom(msg.sender, address(this), totalAmount);

        emit OrderCreated(
            orderId,
            msg.sender,
            poolId,
            zeroForOne,
            totalAmount,
            numberOfExecutions,
            executionInterval
        );
    }

    /// @notice Execute next chunk of a TWAP order
    /// @param orderId Order to execute
    /// @return amountExecuted Amount of input token used
    /// @return amountReceived Amount of output token received
    function executeTWAPOrder(uint256 orderId)
        external
        returns (uint256 amountExecuted, uint256 amountReceived)
    {
        TWAPOrder storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.status != OrderStatus.Active) {
            if (order.status == OrderStatus.Completed) revert OrderAlreadyCompleted();
            if (order.status == OrderStatus.Cancelled) revert OrderAlreadyCancelled();
            revert OrderExpired();
        }
        if (block.timestamp > order.deadline) {
            order.status = OrderStatus.Expired;
            emit OrderExpiredEvent(orderId);
            revert OrderExpired();
        }
        if (block.timestamp < order.lastExecutionTime + order.executionInterval) {
            revert TooEarlyToExecute();
        }

        // Calculate amount for this execution
        uint256 remainingAmount = order.totalAmount - order.executedAmount;
        uint256 remainingExecutions = order.numberOfExecutions -
            ((order.executedAmount * order.numberOfExecutions) / order.totalAmount);

        amountExecuted = remainingAmount / remainingExecutions;

        if (amountExecuted == 0) {
            amountExecuted = remainingAmount; // Execute remaining dust
        }

        // Update order state
        order.executedAmount += amountExecuted;
        order.lastExecutionTime = block.timestamp;

        // Execute actual swap via PoolManager
        PoolKey memory key = poolKeys[order.poolId];

        // Determine the input token and approve PoolManager to spend it
        Currency inputCurrency = order.zeroForOne ? key.currency0 : key.currency1;
        IERC20(inputCurrency.toAddress()).safeIncreaseAllowance(address(poolManager), amountExecuted);

        // Build swap params with proper price limits
        uint160 sqrtPriceLimitX96 = order.zeroForOne
            ? TickMath.MIN_SQRT_PRICE + 1
            : TickMath.MAX_SQRT_PRICE - 1;

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: order.zeroForOne,
            amountSpecified: int256(amountExecuted),
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });

        (int256 amount0, int256 amount1) = poolManager.swap(key, swapParams);

        // Calculate amount received from swap
        // For zeroForOne: amount0 is positive (tokens in), amount1 is negative (tokens out)
        // For oneForZero: amount1 is positive (tokens in), amount0 is negative (tokens out)
        uint256 grossAmountReceived;
        if (order.zeroForOne) {
            grossAmountReceived = amount1 < 0 ? uint256(-amount1) : 0;
        } else {
            grossAmountReceived = amount0 < 0 ? uint256(-amount0) : 0;
        }

        // Deduct execution fee and send to feeCollector
        uint256 feeAmount = (grossAmountReceived * EXECUTION_FEE_BPS) / 10000;
        amountReceived = grossAmountReceived - feeAmount;

        // Check slippage protection
        if (amountReceived < order.minAmountPerExecution) {
            revert SlippageExceeded();
        }

        // Transfer output tokens to order owner
        Currency outputCurrency = order.zeroForOne ? key.currency1 : key.currency0;
        if (amountReceived > 0) {
            IERC20(outputCurrency.toAddress()).safeTransfer(order.owner, amountReceived);
        }

        // Transfer fee to feeCollector
        if (feeAmount > 0) {
            IERC20(outputCurrency.toAddress()).safeTransfer(feeCollector, feeAmount);
        }

        // Calculate execution number
        uint256 executionNumber = (order.executedAmount * order.numberOfExecutions) / order.totalAmount;

        emit OrderExecuted(orderId, executionNumber, amountExecuted, amountReceived);

        // Check if order is complete
        if (order.executedAmount >= order.totalAmount) {
            order.status = OrderStatus.Completed;
            emit OrderCompleted(orderId, order.executedAmount);
        }
    }

    /// @notice Cancel an active TWAP order
    /// @param orderId Order to cancel
    function cancelTWAPOrder(uint256 orderId) external {
        TWAPOrder storage order = orders[orderId];

        if (order.owner != msg.sender) revert OrderNotOwned();
        if (order.status != OrderStatus.Active) revert OrderAlreadyCancelled();

        uint256 remainingAmount = order.totalAmount - order.executedAmount;
        order.status = OrderStatus.Cancelled;

        emit OrderCancelled(orderId, remainingAmount);

        // Refund remaining input tokens to the order owner
        if (remainingAmount > 0) {
            PoolKey memory key = poolKeys[order.poolId];
            Currency inputCurrency = order.zeroForOne ? key.currency0 : key.currency1;
            IERC20(inputCurrency.toAddress()).safeTransfer(order.owner, remainingAmount);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get order details
    function getOrder(uint256 orderId) external view returns (TWAPOrder memory) {
        return orders[orderId];
    }

    /// @notice Get user's orders
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /// @notice Get pool's active orders
    function getPoolOrders(bytes32 poolId) external view returns (uint256[] memory) {
        return poolOrders[poolId];
    }

    /// @notice Check if order is ready for next execution
    function isReadyForExecution(uint256 orderId) external view returns (bool) {
        TWAPOrder memory order = orders[orderId];

        if (order.status != OrderStatus.Active) return false;
        if (block.timestamp > order.deadline) return false;
        if (block.timestamp < order.lastExecutionTime + order.executionInterval) return false;
        if (order.executedAmount >= order.totalAmount) return false;

        return true;
    }

    /// @notice Get next execution amount for an order
    function getNextExecutionAmount(uint256 orderId) external view returns (uint256) {
        TWAPOrder memory order = orders[orderId];

        if (order.status != OrderStatus.Active) return 0;

        uint256 remainingAmount = order.totalAmount - order.executedAmount;
        uint256 remainingExecutions = order.numberOfExecutions -
            ((order.executedAmount * order.numberOfExecutions) / order.totalAmount);

        if (remainingExecutions == 0) return remainingAmount;

        return remainingAmount / remainingExecutions;
    }

    /// @notice Get order progress
    function getOrderProgress(uint256 orderId) external view returns (
        uint256 executedAmount,
        uint256 totalAmount,
        uint256 percentComplete,
        uint256 executionsRemaining
    ) {
        TWAPOrder memory order = orders[orderId];

        executedAmount = order.executedAmount;
        totalAmount = order.totalAmount;
        percentComplete = totalAmount > 0 ? (executedAmount * 10000) / totalAmount : 0;
        executionsRemaining = order.numberOfExecutions -
            ((order.executedAmount * order.numberOfExecutions) / order.totalAmount);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Set fee collector address
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAmount();

        address oldCollector = feeCollector;
        feeCollector = _feeCollector;

        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }
}

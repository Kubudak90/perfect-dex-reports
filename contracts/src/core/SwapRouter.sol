// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {PoolKey, PoolIdLibrary} from "../types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAllowanceTransfer} from "@permit2/src/interfaces/IAllowanceTransfer.sol";

/// @title SwapRouter
/// @author BaseBook Team
/// @notice Routes swap requests through pools, supports multi-hop and Permit2
/// @dev Uses PoolManager for all pool interactions
contract SwapRouter is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    /// @notice The PoolManager contract
    IPoolManager public immutable poolManager;

    /// @notice The Permit2 contract
    IAllowanceTransfer public immutable permit2;

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Default maximum price impact per hop in basis points (500 = 5%)
    uint256 public constant DEFAULT_MAX_PRICE_IMPACT_BPS = 500;

    /// @notice Basis points denominator
    uint256 private constant BPS_DENOMINATOR = 10_000;

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Parameters for a single-pool exact input swap
    struct ExactInputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        address recipient;
        uint256 deadline;
    }

    /// @notice Parameters for multi-hop exact input swap
    struct ExactInputParams {
        bytes path; // Encoded path of PoolKey[]
        uint256 amountIn;
        uint256 amountOutMinimum;
        address recipient;
        uint256 deadline;
        uint256 maxPriceImpactBps; // Max price impact per hop in bps (0 = use DEFAULT_MAX_PRICE_IMPACT_BPS)
    }

    /// @notice Parameters for exact output single swap
    struct ExactOutputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
        address recipient;
        uint256 deadline;
    }

    /// @notice Parameters for exact output multi-hop swap
    struct ExactOutputParams {
        bytes path;
        uint256 amountOut;
        uint256 amountInMaximum;
        address recipient;
        uint256 deadline;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error DeadlineExpired();
    error InsufficientOutputAmount();
    error ExcessiveInputAmount();
    error ExcessivePriceImpact();
    error InvalidPath();
    error ZeroAmount();

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event SwapExecuted(
        address indexed sender,
        address indexed recipient,
        Currency indexed tokenIn,
        Currency tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Constructor
    /// @param _poolManager The PoolManager contract address
    /// @param _permit2 The Permit2 contract address
    constructor(address _poolManager, address _permit2) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        permit2 = IAllowanceTransfer(_permit2);
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAUSE / UNPAUSE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pauses all swap operations
    /// @dev Only callable by the contract owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses all swap operations
    /// @dev Only callable by the contract owner
    function unpause() external onlyOwner {
        _unpause();
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Ensures the deadline has not passed
    modifier checkDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    // ══════════════════════════════════════════════════════════════════════
    // EXACT INPUT SWAPS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The parameters for the swap
    /// @return amountOut The amount of the received token
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        if (params.amountIn == 0) revert ZeroAmount();

        // Transfer tokens from sender
        Currency tokenIn = params.zeroForOne ? params.poolKey.currency0 : params.poolKey.currency1;
        _pay(tokenIn, msg.sender, address(this), params.amountIn);

        // Execute swap through PoolManager
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: int256(params.amountIn),
            sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
                ? (params.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1)
                : params.sqrtPriceLimitX96
        });

        (int256 amount0, int256 amount1) = poolManager.swap(params.poolKey, swapParams);

        // Calculate output amount (negative value means tokens out)
        amountOut = uint256(-(params.zeroForOne ? amount1 : amount0));

        // Check slippage
        if (amountOut < params.amountOutMinimum) revert InsufficientOutputAmount();

        // Transfer output tokens to recipient
        Currency tokenOut = params.zeroForOne ? params.poolKey.currency1 : params.poolKey.currency0;
        _pay(tokenOut, address(this), params.recipient, amountOut);

        emit SwapExecuted(msg.sender, params.recipient, tokenIn, tokenOut, params.amountIn, amountOut);
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another along the specified path
    /// @param params The parameters for the swap
    /// @return amountOut The amount of the received token
    function exactInput(ExactInputParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        if (params.amountIn == 0) revert ZeroAmount();

        // Decode path into array of pool keys
        PoolKey[] memory path = abi.decode(params.path, (PoolKey[]));
        if (path.length == 0) revert InvalidPath();

        uint256 currentAmountIn = params.amountIn;

        // Transfer initial tokens from sender to this contract
        Currency tokenIn = path[0].currency0;
        // Determine if first swap is zeroForOne based on path
        // For multi-hop, we need to track current token through the path
        Currency currentToken = tokenIn;
        _pay(currentToken, msg.sender, address(this), currentAmountIn);

        // Resolve effective max price impact per hop
        uint256 maxImpactBps = _effectiveMaxPriceImpact(params.maxPriceImpactBps);

        // Execute swaps through each pool in the path
        for (uint256 i = 0; i < path.length; i++) {
            PoolKey memory poolKey = path[i];

            // Determine swap direction based on current token
            bool zeroForOne = Currency.unwrap(currentToken) == Currency.unwrap(poolKey.currency0);

            // Record pre-swap price for intermediate slippage protection
            (uint160 preSwapSqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());

            // Execute swap through PoolManager
            IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(currentAmountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            });

            (int256 amount0, int256 amount1) = poolManager.swap(poolKey, swapParams);

            // Check intermediate price impact to protect against MEV sandwich attacks
            (uint160 postSwapSqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
            _checkPriceImpact(preSwapSqrtPriceX96, postSwapSqrtPriceX96, maxImpactBps);

            // Calculate output amount (negative value means tokens out)
            currentAmountIn = uint256(-(zeroForOne ? amount1 : amount0));

            // Update current token for next iteration
            currentToken = zeroForOne ? poolKey.currency1 : poolKey.currency0;
        }

        amountOut = currentAmountIn;

        // Check final output slippage
        if (amountOut < params.amountOutMinimum) revert InsufficientOutputAmount();

        // Transfer output tokens to recipient
        _pay(currentToken, address(this), params.recipient, amountOut);

        emit SwapExecuted(msg.sender, params.recipient, tokenIn, currentToken, params.amountIn, amountOut);
    }

    // ══════════════════════════════════════════════════════════════════════
    // EXACT OUTPUT SWAPS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @param params The parameters for the swap
    /// @return amountIn The amount of the input token
    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        if (params.amountOut == 0) revert ZeroAmount();

        // Execute swap through PoolManager
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: -int256(params.amountOut),
            sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
                ? (params.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1)
                : params.sqrtPriceLimitX96
        });

        (int256 amount0, int256 amount1) = poolManager.swap(params.poolKey, swapParams);

        // Calculate input amount (positive value means tokens in)
        amountIn = uint256(params.zeroForOne ? amount0 : amount1);

        // Check slippage
        if (amountIn > params.amountInMaximum) revert ExcessiveInputAmount();

        // Transfer input tokens from sender
        Currency tokenIn = params.zeroForOne ? params.poolKey.currency0 : params.poolKey.currency1;
        _pay(tokenIn, msg.sender, address(this), amountIn);

        // Transfer output tokens to recipient
        Currency tokenOut = params.zeroForOne ? params.poolKey.currency1 : params.poolKey.currency0;
        _pay(tokenOut, address(this), params.recipient, params.amountOut);

        emit SwapExecuted(msg.sender, params.recipient, tokenIn, tokenOut, amountIn, params.amountOut);
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another along the specified path (reversed)
    /// @dev Path is encoded in reverse order (from output to input token)
    /// @param params The parameters for the swap
    /// @return amountIn The amount of the input token
    function exactOutput(ExactOutputParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        if (params.amountOut == 0) revert ZeroAmount();

        // Decode path into array of pool keys (path is in reverse order: output -> input)
        PoolKey[] memory path = abi.decode(params.path, (PoolKey[]));
        if (path.length == 0) revert InvalidPath();

        // For exact output multi-hop, we execute swaps in reverse order
        // Each swap specifies exact output, and we calculate the required input
        uint256 currentAmountOut = params.amountOut;

        // Track the current token (starting from output token and working backwards)
        // In reverse path, the last pool's output token is our final output
        Currency currentToken;
        Currency tokenOut;

        // Determine the final output token from the last pool in path
        // Path is reversed, so path[0] is closest to output
        {
            PoolKey memory lastPool = path[0];
            // Determine which token is the output based on path structure
            // Assuming currency1 of first pool (in reversed path) is the output
            tokenOut = lastPool.currency1;
            currentToken = tokenOut;
        }

        // Track input token for final transfer
        Currency tokenIn;

        // Execute swaps in reverse order (from output to input)
        for (uint256 i = 0; i < path.length; i++) {
            PoolKey memory poolKey = path[i];

            // Determine swap direction based on current token (which is the output of this swap)
            // If current token is currency1, then zeroForOne = true (swap token0 -> token1)
            // If current token is currency0, then zeroForOne = false (swap token1 -> token0)
            bool zeroForOne = Currency.unwrap(currentToken) == Currency.unwrap(poolKey.currency1);

            // Execute swap with negative amountSpecified for exact output
            IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(currentAmountOut),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            });

            (int256 amount0, int256 amount1) = poolManager.swap(poolKey, swapParams);

            // Calculate input amount required (positive value is input)
            currentAmountOut = uint256(zeroForOne ? amount0 : amount1);

            // Update current token for next iteration (input token of this swap)
            currentToken = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        }

        amountIn = currentAmountOut;
        tokenIn = currentToken;

        // Check slippage
        if (amountIn > params.amountInMaximum) revert ExcessiveInputAmount();

        // Transfer input tokens from sender
        _pay(tokenIn, msg.sender, address(this), amountIn);

        // Transfer output tokens to recipient
        _pay(tokenOut, address(this), params.recipient, params.amountOut);

        emit SwapExecuted(msg.sender, params.recipient, tokenIn, tokenOut, amountIn, params.amountOut);
    }

    // ══════════════════════════════════════════════════════════════════════
    // MULTI-HOP CONVENIENCE FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Swaps exact input through multiple pools using an array of PoolKeys
    /// @param path Array of pool keys defining the swap path
    /// @param amountIn The exact input amount
    /// @param amountOutMinimum Minimum output amount (slippage protection)
    /// @param recipient Address to receive output tokens
    /// @param deadline Transaction deadline
    /// @param maxPriceImpactBps Max price impact per hop in bps (0 = use DEFAULT_MAX_PRICE_IMPACT_BPS)
    /// @return amountOut The output amount received
    function exactInputMultihop(
        PoolKey[] calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline,
        uint256 maxPriceImpactBps
    ) external payable nonReentrant whenNotPaused checkDeadline(deadline) returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (path.length == 0) revert InvalidPath();

        uint256 currentAmountIn = amountIn;

        // Determine the initial input token from the first pool
        // We assume the path is structured so currency0 of first pool is the input
        Currency tokenIn = path[0].currency0;
        Currency currentToken = tokenIn;

        // Resolve effective max price impact per hop
        uint256 maxImpactBps = _effectiveMaxPriceImpact(maxPriceImpactBps);

        // Transfer initial tokens from sender
        _pay(currentToken, msg.sender, address(this), currentAmountIn);

        // Execute swaps through each pool in the path
        for (uint256 i = 0; i < path.length; i++) {
            PoolKey calldata poolKey = path[i];

            // Determine swap direction based on current token
            bool zeroForOne = Currency.unwrap(currentToken) == Currency.unwrap(poolKey.currency0);

            // Record pre-swap price for intermediate slippage protection
            bytes32 poolId = PoolIdLibrary.toId(poolKey);
            (uint160 preSwapSqrtPriceX96,,,) = poolManager.getSlot0(poolId);

            // Execute swap through PoolManager
            IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(currentAmountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            });

            (int256 amount0, int256 amount1) = poolManager.swap(poolKey, swapParams);

            // Check intermediate price impact to protect against MEV sandwich attacks
            (uint160 postSwapSqrtPriceX96,,,) = poolManager.getSlot0(poolId);
            _checkPriceImpact(preSwapSqrtPriceX96, postSwapSqrtPriceX96, maxImpactBps);

            // Calculate output amount (negative value means tokens out)
            currentAmountIn = uint256(-(zeroForOne ? amount1 : amount0));

            // Update current token for next iteration
            currentToken = zeroForOne ? poolKey.currency1 : poolKey.currency0;
        }

        amountOut = currentAmountIn;

        // Check final output slippage
        if (amountOut < amountOutMinimum) revert InsufficientOutputAmount();

        // Transfer output tokens to recipient
        _pay(currentToken, address(this), recipient, amountOut);

        emit SwapExecuted(msg.sender, recipient, tokenIn, currentToken, amountIn, amountOut);
    }

    /// @notice Swaps exact output through multiple pools using an array of PoolKeys
    /// @dev Path should be in reverse order (from output to input token)
    /// @param path Array of pool keys defining the swap path (reversed)
    /// @param amountOut The exact output amount desired
    /// @param amountInMaximum Maximum input amount (slippage protection)
    /// @param recipient Address to receive output tokens
    /// @param deadline Transaction deadline
    /// @return amountIn The input amount required
    function exactOutputMultihop(
        PoolKey[] calldata path,
        uint256 amountOut,
        uint256 amountInMaximum,
        address recipient,
        uint256 deadline
    ) external payable nonReentrant whenNotPaused checkDeadline(deadline) returns (uint256 amountIn) {
        if (amountOut == 0) revert ZeroAmount();
        if (path.length == 0) revert InvalidPath();

        uint256 currentAmountOut = amountOut;

        // Determine the final output token from the first pool in reversed path
        Currency tokenOut = path[0].currency1;
        Currency currentToken = tokenOut;

        // Track input token
        Currency tokenIn;

        // Execute swaps in reverse order (from output to input)
        for (uint256 i = 0; i < path.length; i++) {
            PoolKey calldata poolKey = path[i];

            // Determine swap direction based on current token (output of this swap)
            bool zeroForOne = Currency.unwrap(currentToken) == Currency.unwrap(poolKey.currency1);

            // Execute swap with negative amountSpecified for exact output
            IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(currentAmountOut),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            });

            (int256 amount0, int256 amount1) = poolManager.swap(poolKey, swapParams);

            // Calculate input amount required (positive value is input)
            currentAmountOut = uint256(zeroForOne ? amount0 : amount1);

            // Update current token for next iteration (input token of this swap)
            currentToken = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        }

        amountIn = currentAmountOut;
        tokenIn = currentToken;

        // Check slippage
        if (amountIn > amountInMaximum) revert ExcessiveInputAmount();

        // Transfer input tokens from sender
        _pay(tokenIn, msg.sender, address(this), amountIn);

        // Transfer output tokens to recipient
        _pay(tokenOut, address(this), recipient, amountOut);

        emit SwapExecuted(msg.sender, recipient, tokenIn, tokenOut, amountIn, amountOut);
    }

    // ══════════════════════════════════════════════════════════════════════
    // PERMIT2 FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Swap with Permit2 signature (exact input single)
    /// @param params The swap parameters
    /// @param permitSingle The Permit2 signature data
    function exactInputSingleWithPermit2(
        ExactInputSingleParams calldata params,
        IAllowanceTransfer.PermitSingle calldata permitSingle,
        bytes calldata signature
    ) external payable whenNotPaused returns (uint256 amountOut) {
        // Execute permit
        permit2.permit(msg.sender, permitSingle, signature);

        // Execute swap
        return this.exactInputSingle(params);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Checks that a pool's price did not move more than the allowed basis points
    /// @param preSwapSqrtPriceX96 The pool's sqrtPriceX96 before the swap
    /// @param postSwapSqrtPriceX96 The pool's sqrtPriceX96 after the swap
    /// @param maxImpactBps The maximum allowed price movement in basis points
    function _checkPriceImpact(
        uint160 preSwapSqrtPriceX96,
        uint160 postSwapSqrtPriceX96,
        uint256 maxImpactBps
    ) internal pure {
        // Compare sqrtPrice values directly. Since price = sqrtPrice^2,
        // a movement of X bps in sqrtPrice corresponds to ~2X bps in price.
        // We check sqrtPrice movement which is a stricter (more conservative) bound.
        uint256 priceBefore = uint256(preSwapSqrtPriceX96);
        uint256 priceAfter = uint256(postSwapSqrtPriceX96);

        // Calculate absolute difference
        uint256 delta = priceBefore > priceAfter
            ? priceBefore - priceAfter
            : priceAfter - priceBefore;

        // Check: delta / priceBefore <= maxImpactBps / BPS_DENOMINATOR
        // Rearranged to avoid division: delta * BPS_DENOMINATOR <= maxImpactBps * priceBefore
        if (delta * BPS_DENOMINATOR > maxImpactBps * priceBefore) {
            revert ExcessivePriceImpact();
        }
    }

    /// @notice Returns the effective max price impact, using the default if 0 is provided
    /// @param maxPriceImpactBps The caller-specified max impact (0 = use default)
    /// @return The effective max price impact in basis points
    function _effectiveMaxPriceImpact(uint256 maxPriceImpactBps) internal pure returns (uint256) {
        return maxPriceImpactBps == 0 ? DEFAULT_MAX_PRICE_IMPACT_BPS : maxPriceImpactBps;
    }

    /// @notice Pay tokens (supports both ERC20 and native ETH)
    /// @param currency The currency to pay
    /// @param payer The address paying
    /// @param recipient The address receiving
    /// @param amount The amount to pay
    function _pay(Currency currency, address payer, address recipient, uint256 amount) internal {
        if (currency.isNative()) {
            // Native ETH
            if (payer == address(this)) {
                // Pay from contract
                (bool success,) = recipient.call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                // Expect ETH sent with transaction
                require(msg.value >= amount, "Insufficient ETH");
            }
        } else {
            // ERC20
            if (payer == address(this)) {
                // Pay from contract
                IERC20(Currency.unwrap(currency)).safeTransfer(recipient, amount);
            } else {
                // Pay from payer
                IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, recipient, amount);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // RECEIVE ETH
    // ══════════════════════════════════════════════════════════════════════

    receive() external payable {}

    // ══════════════════════════════════════════════════════════════════════
    // PATH ENCODING HELPERS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Encodes an array of PoolKeys into bytes for use with exactInput/exactOutput
    /// @param path Array of pool keys
    /// @return Encoded path as bytes
    function encodePath(PoolKey[] memory path) external pure returns (bytes memory) {
        return abi.encode(path);
    }

    /// @notice Decodes bytes path into an array of PoolKeys
    /// @param encodedPath Encoded path bytes
    /// @return path Array of pool keys
    function decodePath(bytes memory encodedPath) external pure returns (PoolKey[] memory path) {
        path = abi.decode(encodedPath, (PoolKey[]));
    }
}

/// @notice Minimal TickMath constants for SwapRouter
library TickMath {
    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
}

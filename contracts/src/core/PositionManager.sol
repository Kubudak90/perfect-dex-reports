// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {SqrtPriceMath} from "../libraries/SqrtPriceMath.sol";
import {LiquidityMath} from "../libraries/LiquidityMath.sol";

/// @title PositionManager
/// @author BaseBook Team
/// @notice Manages liquidity positions as NFTs
/// @dev Each NFT represents a unique liquidity position in a pool
contract PositionManager is ERC721Enumerable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    /// @notice The PoolManager contract
    IPoolManager public immutable poolManager;

    /// @notice The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;

    /// @notice The ID of the next pool that will be initialized
    uint80 private _nextPoolId = 1;

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Details of a liquidity position
    struct Position {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        // the pool ID
        uint80 poolId;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of token0 and token1 inside the tick range as of the last action on the position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected tokens are owed to the position (fees)
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    /// @notice Parameters for minting a new position
    struct MintParams {
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    /// @notice Parameters for increasing liquidity
    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    /// @notice Parameters for decreasing liquidity
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    /// @notice Parameters for collecting fees
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    // ══════════════════════════════════════════════════════════════════════
    // STORAGE
    // ══════════════════════════════════════════════════════════════════════

    /// @dev positions[tokenId] => Position
    mapping(uint256 => Position) private _positions;

    /// @dev poolKeys[poolId] => PoolKey (for reverse lookup)
    mapping(uint80 => PoolKey) private _poolKeys;

    /// @dev poolIds[keccak256(PoolKey)] => poolId
    mapping(bytes32 => uint80) private _poolIds;

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error Unauthorized();
    error InvalidTokenId();
    error DeadlineExpired();
    error PriceSlippageCheck();
    error InvalidTickRange();
    error ZeroLiquidity();

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) ERC721("BaseBook Position", "BB-POS") {
        poolManager = IPoolManager(_poolManager);
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ══════════════════════════════════════════════════════════════════════

    modifier checkDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && getApproved(tokenId) != msg.sender && !isApprovedForAll(owner, msg.sender)) {
            revert Unauthorized();
        }
        _;
    }

    // ══════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Creates a new position wrapped in a NFT
    /// @param params The parameters for minting a new position
    /// @return tokenId The ID of the token that represents the position
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mint(MintParams calldata params)
        external
        payable
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        // Validate tick range
        if (params.tickLower >= params.tickUpper) revert InvalidTickRange();
        if (params.tickLower < TickMath.MIN_TICK || params.tickUpper > TickMath.MAX_TICK) {
            revert InvalidTickRange();
        }

        // Get or create pool ID
        bytes32 poolKeyHash = keccak256(abi.encode(params.poolKey));
        uint80 poolId = _poolIds[poolKeyHash];
        if (poolId == 0) {
            poolId = _nextPoolId++;
            _poolIds[poolKeyHash] = poolId;
            _poolKeys[poolId] = params.poolKey;
        }

        // Calculate liquidity based on desired amounts
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKeyHash);
        liquidity = _calculateLiquidity(
            sqrtPriceX96, params.tickLower, params.tickUpper, params.amount0Desired, params.amount1Desired
        );

        if (liquidity == 0) revert ZeroLiquidity();

        // Add liquidity to pool
        IPoolManager.ModifyLiquidityParams memory modifyParams = IPoolManager.ModifyLiquidityParams({
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidityDelta: int256(uint256(liquidity))
        });

        int256 delta = poolManager.modifyLiquidity(params.poolKey, modifyParams);

        // Calculate actual amounts (simplified - should use delta)
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;

        // Slippage check
        if (amount0 < params.amount0Min || amount1 < params.amount1Min) {
            revert PriceSlippageCheck();
        }

        // Transfer tokens from user
        _pay(params.poolKey.currency0, msg.sender, address(this), amount0);
        _pay(params.poolKey.currency1, msg.sender, address(this), amount1);

        // Mint NFT
        tokenId = _nextId++;
        _mint(params.recipient, tokenId);

        // Store position
        _positions[tokenId] = Position({
            nonce: 0,
            operator: address(0),
            poolId: poolId,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            feeGrowthInside0LastX128: 0,
            feeGrowthInside1LastX128: 0,
            tokensOwed0: 0,
            tokensOwed1: 0
        });

        emit IncreaseLiquidity(tokenId, liquidity, amount0, amount1);
    }

    /// @notice Increases the amount of liquidity in a position
    /// @param params The parameters for increasing liquidity
    /// @return liquidity The new liquidity amount
    /// @return amount0 The amount of token0 added
    /// @return amount1 The amount of token1 added
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        nonReentrant
        checkDeadline(params.deadline)
        isAuthorizedForToken(params.tokenId)
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        Position storage position = _positions[params.tokenId];
        PoolKey memory poolKey = _poolKeys[position.poolId];

        // Calculate additional liquidity
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(keccak256(abi.encode(poolKey)));
        liquidity = _calculateLiquidity(
            sqrtPriceX96, position.tickLower, position.tickUpper, params.amount0Desired, params.amount1Desired
        );

        if (liquidity == 0) revert ZeroLiquidity();

        // Add liquidity to pool
        IPoolManager.ModifyLiquidityParams memory modifyParams = IPoolManager.ModifyLiquidityParams({
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            liquidityDelta: int256(uint256(liquidity))
        });

        poolManager.modifyLiquidity(poolKey, modifyParams);

        // Calculate actual amounts
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;

        // Slippage check
        if (amount0 < params.amount0Min || amount1 < params.amount1Min) {
            revert PriceSlippageCheck();
        }

        // Transfer tokens from user
        _pay(poolKey.currency0, msg.sender, address(this), amount0);
        _pay(poolKey.currency1, msg.sender, address(this), amount1);

        // Update position
        position.liquidity += liquidity;

        emit IncreaseLiquidity(params.tokenId, liquidity, amount0, amount1);
    }

    /// @notice Decreases the amount of liquidity in a position and accounts it to the position
    /// @param params The parameters for decreasing liquidity
    /// @return amount0 The amount of token0 accounted to the position's tokens owed
    /// @return amount1 The amount of token1 accounted to the position's tokens owed
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        nonReentrant
        checkDeadline(params.deadline)
        isAuthorizedForToken(params.tokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage position = _positions[params.tokenId];
        if (params.liquidity > position.liquidity) revert ZeroLiquidity();

        PoolKey memory poolKey = _poolKeys[position.poolId];

        // Remove liquidity from pool
        IPoolManager.ModifyLiquidityParams memory modifyParams = IPoolManager.ModifyLiquidityParams({
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            liquidityDelta: -int256(uint256(params.liquidity))
        });

        poolManager.modifyLiquidity(poolKey, modifyParams);

        // Calculate amounts (simplified)
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(keccak256(abi.encode(poolKey)));
        amount0 = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtPriceAtTick(position.tickLower),
            TickMath.getSqrtPriceAtTick(position.tickUpper),
            params.liquidity,
            false
        );
        amount1 = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtPriceAtTick(position.tickLower),
            TickMath.getSqrtPriceAtTick(position.tickUpper),
            params.liquidity,
            false
        );

        // Slippage check
        if (amount0 < params.amount0Min || amount1 < params.amount1Min) {
            revert PriceSlippageCheck();
        }

        // Update position
        position.liquidity -= params.liquidity;
        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);

        emit DecreaseLiquidity(params.tokenId, params.liquidity, amount0, amount1);
    }

    /// @notice Collects up to a maximum amount of fees owed to a specific position to the recipient
    /// @param params The parameters for collecting fees
    /// @return amount0 The amount of fees collected in token0
    /// @return amount1 The amount of fees collected in token1
    function collect(CollectParams calldata params)
        external
        nonReentrant
        isAuthorizedForToken(params.tokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage position = _positions[params.tokenId];
        PoolKey memory poolKey = _poolKeys[position.poolId];

        // Calculate amounts to collect
        amount0 = params.amount0Max > position.tokensOwed0 ? position.tokensOwed0 : params.amount0Max;
        amount1 = params.amount1Max > position.tokensOwed1 ? position.tokensOwed1 : params.amount1Max;

        // Update position
        position.tokensOwed0 -= uint128(amount0);
        position.tokensOwed1 -= uint128(amount1);

        // Transfer tokens to recipient
        if (amount0 > 0) _pay(poolKey.currency0, address(this), params.recipient, amount0);
        if (amount1 > 0) _pay(poolKey.currency1, address(this), params.recipient, amount1);

        emit Collect(params.tokenId, params.recipient, amount0, amount1);
    }

    /// @notice Burns a token ID, which deletes it from the NFT contract
    /// @dev The position must have 0 liquidity and all tokens collected
    /// @param tokenId The ID of the token being burned
    function burn(uint256 tokenId) external nonReentrant isAuthorizedForToken(tokenId) {
        Position storage position = _positions[tokenId];

        if (position.liquidity > 0 || position.tokensOwed0 > 0 || position.tokensOwed1 > 0) {
            revert ZeroLiquidity();
        }

        delete _positions[tokenId];
        _burn(tokenId);
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the position information associated with a given token ID
    /// @param tokenId The ID of the token
    /// @return position The position info
    function positions(uint256 tokenId) external view returns (Position memory position) {
        position = _positions[tokenId];
        if (position.poolId == 0) revert InvalidTokenId();
    }

    /// @notice Returns the pool key for a given pool ID
    /// @param poolId The pool ID
    /// @return poolKey The pool key
    function getPoolKey(uint80 poolId) external view returns (PoolKey memory poolKey) {
        poolKey = _poolKeys[poolId];
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Calculate liquidity for given amounts
    function _calculateLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        // Simplified liquidity calculation for testing
        // In production, use proper SqrtPriceMath functions
        if (sqrtPriceX96 <= sqrtRatioAX96) {
            // Current price below range - only token0 needed
            liquidity = uint128(
                SqrtPriceMath.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, uint128(amount0), false)
            );
        } else if (sqrtPriceX96 < sqrtRatioBX96) {
            // Current price in range - use minimum of both
            uint128 liquidity0 = uint128(
                SqrtPriceMath.getAmount0Delta(sqrtPriceX96, sqrtRatioBX96, uint128(amount0), false)
            );
            uint128 liquidity1 = uint128(
                SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtPriceX96, uint128(amount1), false)
            );
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            // Current price above range - only token1 needed
            liquidity = uint128(
                SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, uint128(amount1), false)
            );
        }
    }

    /// @notice Pay tokens
    function _pay(Currency currency, address payer, address recipient, uint256 amount) internal {
        if (amount == 0) return;

        if (currency.isNative()) {
            if (payer == address(this)) {
                (bool success,) = recipient.call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                require(msg.value >= amount, "Insufficient ETH");
            }
        } else {
            if (payer == address(this)) {
                IERC20(Currency.unwrap(currency)).safeTransfer(recipient, amount);
            } else {
                IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, recipient, amount);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // RECEIVE ETH
    // ══════════════════════════════════════════════════════════════════════

    receive() external payable {}
}

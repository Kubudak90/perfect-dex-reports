// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./BaseHook.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "../types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "../types/Currency.sol";
import {FullMath} from "../libraries/FullMath.sol";
import {SqrtPriceMath} from "../libraries/SqrtPriceMath.sol";
import {TickMath} from "../libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AutoCompoundHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that automatically compounds LP fees back into positions
/// @dev Tracks accumulated fees and reinvests them to increase position liquidity
contract AutoCompoundHook is BaseHook, Ownable2Step {
    using CurrencyLibrary for Currency;

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error PositionNotFound();
    error Unauthorized();
    error InvalidAmount();
    error CompoundingDisabled();
    error InsufficientFees();
    error CompoundTooSoon();
    error NothingToWithdraw();

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Position tracking for auto-compound
    struct Position {
        address owner;              // Position owner
        bytes32 poolId;             // Pool identifier
        int24 tickLower;            // Lower tick of position
        int24 tickUpper;            // Upper tick of position
        uint128 liquidity;          // Current liquidity
        uint256 fees0Accumulated;   // Accumulated fees token0
        uint256 fees1Accumulated;   // Accumulated fees token1
        uint256 lastCompoundTime;   // Last compound timestamp
        bool autoCompoundEnabled;   // Whether auto-compound is active
    }

    /// @notice Pool configuration
    struct PoolConfig {
        bool compoundingEnabled;    // Whether compounding is enabled for pool
        uint256 minCompoundInterval; // Minimum time between compounds
        uint256 minFeesRequired;    // Minimum fees to trigger compound
        uint256 compoundFee;        // Fee taken for compounding (basis points)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Default minimum compound interval (1 hour)
    uint256 public constant DEFAULT_MIN_COMPOUND_INTERVAL = 3600;

    /// @notice Default minimum fees required (in token decimals)
    uint256 public constant DEFAULT_MIN_FEES = 1e15; // 0.001 tokens

    /// @notice Default compound fee (0.1% = 10 basis points)
    uint256 public constant DEFAULT_COMPOUND_FEE = 10;

    /// @notice Maximum compound fee (1% = 100 basis points)
    uint256 public constant MAX_COMPOUND_FEE = 100;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Pool initialization status
    mapping(bytes32 => bool) public isPoolInitialized;

    /// @notice Pool configurations
    mapping(bytes32 => PoolConfig) public poolConfigs;

    /// @notice Stored pool keys for reference during compound operations
    mapping(bytes32 => PoolKey) public poolKeys;

    /// @notice Positions (positionId => Position)
    mapping(uint256 => Position) public positions;

    /// @notice Next position ID
    uint256 public nextPositionId;

    /// @notice User positions (user => positionId[])
    mapping(address => uint256[]) public userPositions;

    /// @notice Pool positions (poolId => positionId[])
    mapping(bytes32 => uint256[]) public poolPositions;

    /// @notice Total compounded value per pool
    mapping(bytes32 => uint256) public totalCompounded;

    /// @notice Fee collector balances (token address => amount)
    mapping(address => uint256) public feeCollectorBalances;

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event PositionRegistered(
        uint256 indexed positionId,
        address indexed owner,
        bytes32 indexed poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    );

    event FeesAccumulated(
        uint256 indexed positionId,
        uint256 fees0,
        uint256 fees1
    );

    event Compounded(
        uint256 indexed positionId,
        uint256 fees0Used,
        uint256 fees1Used,
        uint128 liquidityAdded
    );

    event AutoCompoundEnabled(uint256 indexed positionId);
    event AutoCompoundDisabled(uint256 indexed positionId);
    event PoolConfigUpdated(bytes32 indexed poolId);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeesWithdrawn(address indexed collector, address indexed token, uint256 amount);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        feeCollector = msg.sender;
        nextPositionId = 1;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK PERMISSIONS
    // ══════════════════════════════════════════════════════════════════════

    function getHookPermissions() external pure override returns (Permissions memory) {
        return Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeModifyLiquidity: false,
            afterModifyLiquidity: true,
            beforeSwap: false,
            afterSwap: true
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

        // Store the pool key for later use in compound operations
        poolKeys[poolId] = key;

        // Set default pool configuration
        poolConfigs[poolId] = PoolConfig({
            compoundingEnabled: true,
            minCompoundInterval: DEFAULT_MIN_COMPOUND_INTERVAL,
            minFeesRequired: DEFAULT_MIN_FEES,
            compoundFee: DEFAULT_COMPOUND_FEE
        });

        return IHooks.afterInitialize.selector;
    }

    function afterModifyLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta
    ) external override returns (bytes4) {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Update position tracking for matching registered positions
        uint256[] memory posIds = poolPositions[poolId];
        for (uint256 i = 0; i < posIds.length; i++) {
            Position storage position = positions[posIds[i]];

            // Match position by owner, tick range
            if (position.owner == sender &&
                position.tickLower == params.tickLower &&
                position.tickUpper == params.tickUpper)
            {
                // Sync liquidity value when positions change
                if (params.liquidityDelta > 0) {
                    position.liquidity += uint128(uint256(params.liquidityDelta));
                } else if (params.liquidityDelta < 0) {
                    uint128 liquidityToRemove = uint128(uint256(-params.liquidityDelta));
                    if (liquidityToRemove <= position.liquidity) {
                        position.liquidity -= liquidityToRemove;
                    } else {
                        position.liquidity = 0;
                    }
                }
            }
        }

        return IHooks.afterModifyLiquidity.selector;
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta
    ) external override returns (bytes4) {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Extract swap amounts from the BalanceDelta
        // The delta represents the swap amounts; fees are a portion of the input amount
        int256 swapDelta = BalanceDelta.unwrap(delta);

        // Calculate fee amount based on pool fee tier
        // Fee is in hundredths of a basis point (e.g., 3000 = 0.3%)
        uint256 feeRate = uint256(key.fee);

        // Determine which token is the input based on swap direction
        uint256 swapAmount;
        if (swapDelta > 0) {
            swapAmount = uint256(swapDelta);
        } else if (swapDelta < 0) {
            swapAmount = uint256(-swapDelta);
        }

        // Calculate the fee portion from the swap
        // feeRate is in 1e6 units (3000 = 0.3% = 3000/1000000)
        uint256 feeAmount = FullMath.mulDiv(swapAmount, feeRate, 1_000_000);

        if (feeAmount == 0) {
            _checkAndExecuteAutoCompounds(poolId);
            return IHooks.afterSwap.selector;
        }

        // Get total pool liquidity to calculate each position's proportional share
        uint128 totalLiquidity = poolManager.getLiquidity(poolId);

        if (totalLiquidity == 0) {
            _checkAndExecuteAutoCompounds(poolId);
            return IHooks.afterSwap.selector;
        }

        // Distribute fees proportionally to registered positions based on their liquidity share
        uint256[] memory posIds = poolPositions[poolId];
        for (uint256 i = 0; i < posIds.length; i++) {
            Position storage position = positions[posIds[i]];

            if (position.liquidity == 0) continue;

            // Calculate this position's share of fees
            uint256 positionFeeShare = FullMath.mulDiv(
                feeAmount,
                uint256(position.liquidity),
                uint256(totalLiquidity)
            );

            if (positionFeeShare == 0) continue;

            // Distribute fees based on swap direction
            // zeroForOne: token0 is input, so fees are in token0
            // oneForZero: token1 is input, so fees are in token1
            if (params.zeroForOne) {
                position.fees0Accumulated += positionFeeShare;
            } else {
                position.fees1Accumulated += positionFeeShare;
            }

            emit FeesAccumulated(posIds[i], position.fees0Accumulated, position.fees1Accumulated);
        }

        // After each swap, check if any positions are ready for auto-compound
        _checkAndExecuteAutoCompounds(poolId);

        return IHooks.afterSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Register a position for auto-compounding
    /// @param poolKey Pool of the position
    /// @param tickLower Lower tick bound
    /// @param tickUpper Upper tick bound
    /// @param liquidity Initial liquidity
    /// @return positionId The registered position ID
    function registerPosition(
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external returns (uint256 positionId) {
        bytes32 poolId = keccak256(abi.encode(poolKey));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();
        if (liquidity == 0) revert InvalidAmount();

        positionId = nextPositionId++;

        positions[positionId] = Position({
            owner: msg.sender,
            poolId: poolId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            fees0Accumulated: 0,
            fees1Accumulated: 0,
            lastCompoundTime: block.timestamp,
            autoCompoundEnabled: true
        });

        userPositions[msg.sender].push(positionId);
        poolPositions[poolId].push(positionId);

        emit PositionRegistered(positionId, msg.sender, poolId, tickLower, tickUpper, liquidity);
        emit AutoCompoundEnabled(positionId);
    }

    /// @notice Enable auto-compound for a position
    /// @param positionId Position to enable
    function enableAutoCompound(uint256 positionId) external {
        Position storage position = positions[positionId];

        if (position.owner != msg.sender) revert Unauthorized();

        position.autoCompoundEnabled = true;
        emit AutoCompoundEnabled(positionId);
    }

    /// @notice Disable auto-compound for a position
    /// @param positionId Position to disable
    function disableAutoCompound(uint256 positionId) external {
        Position storage position = positions[positionId];

        if (position.owner != msg.sender) revert Unauthorized();

        position.autoCompoundEnabled = false;
        emit AutoCompoundDisabled(positionId);
    }

    /// @notice Manually compound a position
    /// @param positionId Position to compound
    function compoundPosition(uint256 positionId) external returns (uint128 liquidityAdded) {
        Position storage position = positions[positionId];

        if (position.owner == address(0)) revert PositionNotFound();

        PoolConfig memory config = poolConfigs[position.poolId];

        if (!config.compoundingEnabled) revert CompoundingDisabled();
        if (block.timestamp < position.lastCompoundTime + config.minCompoundInterval) {
            revert CompoundTooSoon();
        }

        uint256 fees0 = position.fees0Accumulated;
        uint256 fees1 = position.fees1Accumulated;

        if (fees0 < config.minFeesRequired && fees1 < config.minFeesRequired) {
            revert InsufficientFees();
        }

        // Calculate compound fee
        uint256 fee0 = (fees0 * config.compoundFee) / 10000;
        uint256 fee1 = (fees1 * config.compoundFee) / 10000;

        uint256 amount0ToCompound = fees0 - fee0;
        uint256 amount1ToCompound = fees1 - fee1;

        // Track fee collector balances for withdrawal
        PoolKey memory key = poolKeys[position.poolId];
        address token0Addr = key.currency0.toAddress();
        address token1Addr = key.currency1.toAddress();

        if (fee0 > 0) {
            feeCollectorBalances[token0Addr] += fee0;
        }
        if (fee1 > 0) {
            feeCollectorBalances[token1Addr] += fee1;
        }

        // Calculate proper liquidity using SqrtPriceMath
        // Get current pool price state
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(position.poolId);

        liquidityAdded = _calculateLiquidity(
            sqrtPriceX96,
            position.tickLower,
            position.tickUpper,
            amount0ToCompound,
            amount1ToCompound
        );

        // Update position
        position.liquidity += liquidityAdded;
        position.fees0Accumulated = 0;
        position.fees1Accumulated = 0;
        position.lastCompoundTime = block.timestamp;

        totalCompounded[position.poolId] += amount0ToCompound + amount1ToCompound;

        emit Compounded(positionId, amount0ToCompound, amount1ToCompound, liquidityAdded);

        return liquidityAdded;
    }

    // ══════════════════════════════════════════════════════════════════════
    // FEE COLLECTOR FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Withdraw accumulated compound fees for a token
    /// @param token The token address to withdraw fees for
    function withdrawFees(address token) external {
        if (msg.sender != feeCollector) revert Unauthorized();

        uint256 amount = feeCollectorBalances[token];
        if (amount == 0) revert NothingToWithdraw();

        feeCollectorBalances[token] = 0;

        emit FeesWithdrawn(feeCollector, token, amount);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Calculate liquidity from token amounts using SqrtPriceMath
    /// @param sqrtPriceX96 Current pool sqrt price
    /// @param tickLower Lower tick of position
    /// @param tickUpper Upper tick of position
    /// @param amount0 Amount of token0
    /// @param amount1 Amount of token1
    /// @return liquidity The calculated liquidity amount
    function _calculateLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        uint160 sqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        if (sqrtPriceX96 <= sqrtPriceLowerX96) {
            // Current price is below position range; only token0 is needed
            // liquidity = amount0 * sqrtPriceLower * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceLower)
            if (amount0 == 0) return 0;
            liquidity = _getLiquidityForAmount0(sqrtPriceLowerX96, sqrtPriceUpperX96, amount0);
        } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
            // Current price is within range; both tokens needed for full liquidity
            // When only one token has fees (common after single-direction swaps),
            // compute liquidity from whichever token is available
            uint128 liquidity0 = _getLiquidityForAmount0(sqrtPriceX96, sqrtPriceUpperX96, amount0);
            uint128 liquidity1 = _getLiquidityForAmount1(sqrtPriceLowerX96, sqrtPriceX96, amount1);

            if (amount0 == 0) {
                liquidity = liquidity1;
            } else if (amount1 == 0) {
                liquidity = liquidity0;
            } else {
                // When both tokens available, use the minimum to avoid over-allocating
                liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
            }
        } else {
            // Current price is above position range; only token1 is needed
            if (amount1 == 0) return 0;
            liquidity = _getLiquidityForAmount1(sqrtPriceLowerX96, sqrtPriceUpperX96, amount1);
        }
    }

    /// @notice Calculate liquidity from token0 amount
    /// @dev liquidity = amount0 * sqrtPriceA * sqrtPriceB / (sqrtPriceB - sqrtPriceA)
    function _getLiquidityForAmount0(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount0
    ) internal pure returns (uint128) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }
        uint256 intermediate = FullMath.mulDiv(uint256(sqrtPriceAX96), uint256(sqrtPriceBX96), 1 << 96);
        uint256 diff = uint256(sqrtPriceBX96) - uint256(sqrtPriceAX96);
        if (diff == 0) return 0;
        return uint128(FullMath.mulDiv(amount0, intermediate, diff));
    }

    /// @notice Calculate liquidity from token1 amount
    /// @dev liquidity = amount1 / (sqrtPriceB - sqrtPriceA)
    function _getLiquidityForAmount1(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount1
    ) internal pure returns (uint128) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }
        uint256 diff = uint256(sqrtPriceBX96) - uint256(sqrtPriceAX96);
        if (diff == 0) return 0;
        return uint128(FullMath.mulDiv(amount1, 1 << 96, diff));
    }

    /// @notice Check and execute auto-compounds for ready positions
    function _checkAndExecuteAutoCompounds(bytes32 poolId) internal {
        PoolConfig memory config = poolConfigs[poolId];

        if (!config.compoundingEnabled) return;

        uint256[] memory posIds = poolPositions[poolId];

        for (uint256 i = 0; i < posIds.length; i++) {
            Position storage position = positions[posIds[i]];

            if (!position.autoCompoundEnabled) continue;
            if (block.timestamp < position.lastCompoundTime + config.minCompoundInterval) continue;

            uint256 fees0 = position.fees0Accumulated;
            uint256 fees1 = position.fees1Accumulated;

            if (fees0 < config.minFeesRequired && fees1 < config.minFeesRequired) continue;

            // Execute compound
            try this.compoundPosition(posIds[i]) {
                // Compound successful
            } catch {
                // Continue on error
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get position details
    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    /// @notice Get user's positions
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    /// @notice Get pool configuration
    function getPoolConfig(bytes32 poolId) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    /// @notice Get stored pool key
    function getPoolKey(bytes32 poolId) external view returns (PoolKey memory) {
        return poolKeys[poolId];
    }

    /// @notice Check if position is ready for compound
    function isReadyForCompound(uint256 positionId) external view returns (bool) {
        Position memory position = positions[positionId];
        PoolConfig memory config = poolConfigs[position.poolId];

        if (!position.autoCompoundEnabled) return false;
        if (!config.compoundingEnabled) return false;
        if (block.timestamp < position.lastCompoundTime + config.minCompoundInterval) return false;

        uint256 fees0 = position.fees0Accumulated;
        uint256 fees1 = position.fees1Accumulated;

        return (fees0 >= config.minFeesRequired || fees1 >= config.minFeesRequired);
    }

    /// @notice Get estimated compound amount
    function getEstimatedCompound(uint256 positionId) external view returns (
        uint256 fees0,
        uint256 fees1,
        uint128 estimatedLiquidity
    ) {
        Position memory position = positions[positionId];
        PoolConfig memory config = poolConfigs[position.poolId];

        fees0 = position.fees0Accumulated;
        fees1 = position.fees1Accumulated;

        uint256 fee0 = (fees0 * config.compoundFee) / 10000;
        uint256 fee1 = (fees1 * config.compoundFee) / 10000;

        uint256 amount0 = fees0 - fee0;
        uint256 amount1 = fees1 - fee1;

        // Calculate proper liquidity using SqrtPriceMath
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(position.poolId);

        estimatedLiquidity = _calculateLiquidity(
            sqrtPriceX96,
            position.tickLower,
            position.tickUpper,
            amount0,
            amount1
        );
    }

    /// @notice Get total value compounded for a pool
    function getTotalCompounded(bytes32 poolId) external view returns (uint256) {
        return totalCompounded[poolId];
    }

    /// @notice Get fee collector balance for a token
    function getFeeCollectorBalance(address token) external view returns (uint256) {
        return feeCollectorBalances[token];
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Update pool configuration
    function updatePoolConfig(
        bytes32 poolId,
        bool compoundingEnabled,
        uint256 minCompoundInterval,
        uint256 minFeesRequired,
        uint256 compoundFee
    ) external onlyOwner {
        if (compoundFee > MAX_COMPOUND_FEE) revert InvalidAmount();

        poolConfigs[poolId] = PoolConfig({
            compoundingEnabled: compoundingEnabled,
            minCompoundInterval: minCompoundInterval,
            minFeesRequired: minFeesRequired,
            compoundFee: compoundFee
        });

        emit PoolConfigUpdated(poolId);
    }

    /// @notice Set fee collector address
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAmount();

        address oldCollector = feeCollector;
        feeCollector = _feeCollector;

        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }
}

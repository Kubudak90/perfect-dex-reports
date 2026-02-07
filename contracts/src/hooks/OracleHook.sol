// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./BaseHook.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {FullMath} from "../libraries/FullMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title OracleHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that provides TWAP (Time-Weighted Average Price) oracle functionality
/// @dev Tracks price observations over time and calculates time-weighted averages
contract OracleHook is BaseHook, Ownable2Step {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error InvalidTimeWindow();
    error InsufficientObservations();
    error ObservationTooOld();

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Observation structure for TWAP calculation
    struct Observation {
        uint32 timestamp; // Block timestamp
        uint160 sqrtPriceX96; // Sqrt price at observation
        uint128 liquidity; // Liquidity at observation
        int56 tickCumulative; // Cumulative tick for TWAP
        bool initialized; // Whether this observation is initialized
    }

    /// @notice Pool oracle state
    struct OracleState {
        uint16 index; // Current observation index
        uint16 cardinality; // Number of observations stored
        uint16 cardinalityNext; // Next observation array length
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Maximum number of observations
    uint16 public constant MAX_CARDINALITY = 65535;

    /// @notice Minimum TWAP window (30 minutes) - prevents flash loan oracle manipulation
    uint32 public constant MIN_TWAP_WINDOW = 1800;

    /// @notice Maximum TWAP window (7 days)
    uint32 public constant MAX_TWAP_WINDOW = 604800;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Oracle state for each pool
    mapping(bytes32 => OracleState) public oracleState;

    /// @notice Observations for each pool
    /// @dev poolId => index => Observation
    mapping(bytes32 => mapping(uint256 => Observation)) public observations;

    /// @notice Pool initialization status
    mapping(bytes32 => bool) public isPoolInitialized;

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event ObservationRecorded(
        bytes32 indexed poolId, uint16 index, uint32 timestamp, uint160 sqrtPriceX96, int24 tick
    );
    event CardinalityIncreased(bytes32 indexed poolId, uint16 oldCardinality, uint16 newCardinality);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
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
            afterModifyLiquidity: true,
            beforeSwap: false,
            afterSwap: true
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Called after pool initialization
    /// @dev Creates the first observation
    function afterInitialize(address, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        // Initialize pool
        isPoolInitialized[poolId] = true;

        // Initialize oracle with cardinality of 1
        oracleState[poolId] = OracleState({index: 0, cardinality: 1, cardinalityNext: 1});

        // Create first observation
        observations[poolId][0] = Observation({
            timestamp: uint32(block.timestamp),
            sqrtPriceX96: sqrtPriceX96,
            liquidity: 0, // No liquidity yet
            tickCumulative: 0, // First observation has 0 cumulative
            initialized: true
        });

        emit ObservationRecorded(poolId, 0, uint32(block.timestamp), sqrtPriceX96, tick);

        return IHooks.afterInitialize.selector;
    }

    /// @notice Called after liquidity modification
    /// @dev Records observation when liquidity changes
    function afterModifyLiquidity(
        address,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta
    ) external override returns (bytes4) {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Get current pool state
        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);

        // Record observation
        _writeObservation(poolId, tick, sqrtPriceX96, liquidity);

        return IHooks.afterModifyLiquidity.selector;
    }

    /// @notice Called after a swap
    /// @dev Records observation after price changes
    function afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata, BalanceDelta)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Get current pool state
        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);

        // Record observation
        _writeObservation(poolId, tick, sqrtPriceX96, liquidity);

        return IHooks.afterSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Writes a new observation
    function _writeObservation(bytes32 poolId, int24 tick, uint160 sqrtPriceX96, uint128 liquidity) internal {
        OracleState memory state = oracleState[poolId];

        // Get the current observation
        Observation memory last = observations[poolId][state.index];

        // Don't write if same timestamp
        if (last.timestamp == block.timestamp) {
            return;
        }

        // Calculate time elapsed
        uint32 delta = uint32(block.timestamp) - last.timestamp;

        // Calculate new tick cumulative
        int56 tickCumulative = last.tickCumulative + (int56(tick) * int56(uint56(delta)));

        // Move to next index (circular buffer)
        uint16 nextIndex = (state.index + 1) % state.cardinality;

        // If we're at the end and can grow, grow
        if (nextIndex == 0 && state.cardinalityNext > state.cardinality) {
            nextIndex = state.cardinality;
            oracleState[poolId].cardinality = state.cardinality + 1;
        }

        // Write new observation
        observations[poolId][nextIndex] = Observation({
            timestamp: uint32(block.timestamp),
            sqrtPriceX96: sqrtPriceX96,
            liquidity: liquidity,
            tickCumulative: tickCumulative,
            initialized: true
        });

        // Update index
        oracleState[poolId].index = nextIndex;

        emit ObservationRecorded(poolId, nextIndex, uint32(block.timestamp), sqrtPriceX96, tick);
    }

    // ══════════════════════════════════════════════════════════════════════
    // TWAP CALCULATION
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Calculates TWAP over a given time window
    /// @param poolId Pool identifier
    /// @param secondsAgo How many seconds ago to start the TWAP calculation
    /// @return tickCumulative The tick cumulative at secondsAgo
    /// @return timestamp The timestamp at secondsAgo
    function observe(bytes32 poolId, uint32 secondsAgo) public view returns (int56 tickCumulative, uint32 timestamp) {
        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        OracleState memory state = oracleState[poolId];

        if (secondsAgo == 0) {
            // Current observation
            Observation memory last = observations[poolId][state.index];
            return (last.tickCumulative, last.timestamp);
        }

        uint32 target = uint32(block.timestamp) - secondsAgo;

        // Find the observation at or before target
        (Observation memory beforeOrAt, Observation memory atOrAfter) = _getSurroundingObservations(poolId, target);

        if (beforeOrAt.timestamp == target) {
            // Exact match
            return (beforeOrAt.tickCumulative, beforeOrAt.timestamp);
        }

        // Interpolate
        uint32 timeDelta = atOrAfter.timestamp - beforeOrAt.timestamp;
        uint32 targetDelta = target - beforeOrAt.timestamp;

        int56 tickCumulativeDelta = atOrAfter.tickCumulative - beforeOrAt.tickCumulative;
        int56 interpolatedTick = beforeOrAt.tickCumulative + (tickCumulativeDelta * int56(uint56(targetDelta)))
            / int56(uint56(timeDelta));

        return (interpolatedTick, target);
    }

    /// @notice Calculates TWAP tick over a time window
    /// @param poolId Pool identifier
    /// @param secondsAgo How many seconds to look back
    /// @return twapTick The time-weighted average tick
    function getTWAP(bytes32 poolId, uint32 secondsAgo) external view returns (int24 twapTick) {
        if (secondsAgo < MIN_TWAP_WINDOW) revert InvalidTimeWindow();
        if (secondsAgo > MAX_TWAP_WINDOW) revert InvalidTimeWindow();

        (int56 tickCumulativeStart,) = observe(poolId, secondsAgo);
        (int56 tickCumulativeEnd,) = observe(poolId, 0);

        int56 tickCumulativeDelta = tickCumulativeEnd - tickCumulativeStart;

        twapTick = int24(tickCumulativeDelta / int56(uint56(secondsAgo)));
    }

    /// @notice Gets observations surrounding a target timestamp
    function _getSurroundingObservations(bytes32 poolId, uint32 target)
        internal
        view
        returns (Observation memory beforeOrAt, Observation memory atOrAfter)
    {
        OracleState memory state = oracleState[poolId];

        // Start from current index and search backwards
        uint16 index = state.index;
        uint16 beforeOrAtIndex;
        uint16 atOrAfterIndex;

        // Find the observation at or before target
        for (uint16 i = 0; i < state.cardinality; i++) {
            Observation memory obs = observations[poolId][index];

            if (!obs.initialized) {
                break;
            }

            if (obs.timestamp <= target) {
                beforeOrAtIndex = index;
                beforeOrAt = obs;

                // Find the next observation
                uint16 nextIndex = (index + 1) % state.cardinality;
                Observation memory nextObs = observations[poolId][nextIndex];

                if (nextObs.initialized && nextObs.timestamp > target) {
                    atOrAfterIndex = nextIndex;
                    atOrAfter = nextObs;
                    return (beforeOrAt, atOrAfter);
                }

                break;
            }

            // Move backwards in circular buffer
            if (index == 0) {
                index = state.cardinality - 1;
            } else {
                index--;
            }
        }

        if (beforeOrAt.timestamp == 0) revert InsufficientObservations();

        // If we didn't find an after observation, use the current one
        atOrAfter = observations[poolId][state.index];
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get the current observation index
    function getObservationIndex(bytes32 poolId) external view returns (uint16) {
        return oracleState[poolId].index;
    }

    /// @notice Get the current cardinality
    function getCardinality(bytes32 poolId) external view returns (uint16) {
        return oracleState[poolId].cardinality;
    }

    /// @notice Get a specific observation
    function getObservation(bytes32 poolId, uint16 index) external view returns (Observation memory) {
        return observations[poolId][index];
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Increase the cardinality of observations for a pool
    /// @dev Allows storing more historical data. Only callable by owner.
    function increaseCardinality(bytes32 poolId, uint16 cardinalityNext) external onlyOwner {
        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        OracleState memory state = oracleState[poolId];

        if (cardinalityNext <= state.cardinality) return;
        if (cardinalityNext > MAX_CARDINALITY) cardinalityNext = MAX_CARDINALITY;

        uint16 oldCardinality = state.cardinality;
        oracleState[poolId].cardinalityNext = cardinalityNext;

        emit CardinalityIncreased(poolId, oldCardinality, cardinalityNext);
    }
}

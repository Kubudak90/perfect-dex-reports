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

/// @title DynamicFeeHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that adjusts swap fees based on pool volatility
/// @dev Tracks price movements and calculates volatility to determine optimal fee tier
contract DynamicFeeHook is BaseHook, Ownable2Step {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PoolNotInitialized();
    error InvalidFeeParameters();

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Minimum fee (0.01%)
    uint24 public constant MIN_FEE = 100;

    /// @notice Maximum fee (1%)
    uint24 public constant MAX_FEE = 10000;

    /// @notice Base fee (0.3%)
    uint24 public constant BASE_FEE = 3000;

    /// @notice Number of price samples to track
    uint256 public constant SAMPLE_SIZE = 10;

    /// @notice Volatility threshold for fee increase (1% = 10000)
    uint256 public constant LOW_VOLATILITY_THRESHOLD = 5000; // 0.5%
    uint256 public constant HIGH_VOLATILITY_THRESHOLD = 20000; // 2%

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Pool price history
    /// @dev poolId => array of historical sqrtPriceX96 values
    mapping(bytes32 => uint160[SAMPLE_SIZE]) public priceHistory;

    /// @notice Current index in circular buffer
    mapping(bytes32 => uint256) public currentIndex;

    /// @notice Number of samples collected
    mapping(bytes32 => uint256) public sampleCount;

    /// @notice Current dynamic fee for each pool
    mapping(bytes32 => uint24) public currentFee;

    /// @notice Pool initialization status
    mapping(bytes32 => bool) public isPoolInitialized;

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event FeeUpdated(bytes32 indexed poolId, uint24 oldFee, uint24 newFee, uint256 volatility);
    event PriceSampleRecorded(bytes32 indexed poolId, uint160 sqrtPriceX96, uint256 sampleIndex);

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
            afterModifyLiquidity: false,
            beforeSwap: true,
            afterSwap: true
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Called after pool initialization
    /// @dev Records initial price and sets base fee
    function afterInitialize(address, PoolKey calldata key, uint160 sqrtPriceX96, int24)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        // Initialize pool
        isPoolInitialized[poolId] = true;
        currentFee[poolId] = BASE_FEE;

        // Record initial price
        priceHistory[poolId][0] = sqrtPriceX96;
        currentIndex[poolId] = 0;
        sampleCount[poolId] = 1;

        emit PriceSampleRecorded(poolId, sqrtPriceX96, 0);

        return IHooks.afterInitialize.selector;
    }

    /// @notice Called before a swap
    /// @dev Returns the current dynamic fee based on volatility
    function beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata)
        external
        view
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Fee is checked by caller via currentFee mapping
        // This hook serves as a validation point

        return IHooks.beforeSwap.selector;
    }

    /// @notice Called after a swap
    /// @dev Records new price and updates fee if needed
    function afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata, BalanceDelta)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Get current pool state
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        // Record new price sample
        _recordPrice(poolId, sqrtPriceX96);

        // Update fee based on volatility (only if we have enough samples)
        if (sampleCount[poolId] >= 3) {
            _updateFee(poolId);
        }

        return IHooks.afterSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Records a new price sample
    function _recordPrice(bytes32 poolId, uint160 sqrtPriceX96) internal {
        // Move to next index (circular buffer)
        uint256 nextIndex = (currentIndex[poolId] + 1) % SAMPLE_SIZE;
        currentIndex[poolId] = nextIndex;

        // Store price
        priceHistory[poolId][nextIndex] = sqrtPriceX96;

        // Increment sample count (capped at SAMPLE_SIZE)
        if (sampleCount[poolId] < SAMPLE_SIZE) {
            sampleCount[poolId]++;
        }

        emit PriceSampleRecorded(poolId, sqrtPriceX96, nextIndex);
    }

    /// @notice Calculates volatility and updates fee
    function _updateFee(bytes32 poolId) internal {
        uint256 volatility = _calculateVolatility(poolId);

        uint24 oldFee = currentFee[poolId];
        uint24 newFee = _calculateDynamicFee(volatility);

        if (newFee != oldFee) {
            currentFee[poolId] = newFee;
            emit FeeUpdated(poolId, oldFee, newFee, volatility);
        }
    }

    /// @notice Calculates price volatility based on historical data
    /// @dev Uses standard deviation of price changes
    /// @return volatility Volatility as a percentage (1% = 10000)
    function _calculateVolatility(bytes32 poolId) internal view returns (uint256) {
        uint256 samples = sampleCount[poolId];
        if (samples < 2) return 0;

        // Calculate mean price change
        uint256 sumAbsChanges = 0;
        uint256 validSamples = 0;

        for (uint256 i = 1; i < samples; i++) {
            uint256 prevIdx = (currentIndex[poolId] + SAMPLE_SIZE - i) % SAMPLE_SIZE;
            uint256 currIdx = (currentIndex[poolId] + SAMPLE_SIZE - i + 1) % SAMPLE_SIZE;

            uint160 prevPrice = priceHistory[poolId][prevIdx];
            uint160 currPrice = priceHistory[poolId][currIdx];

            if (prevPrice == 0 || currPrice == 0) continue;

            // Calculate absolute percentage change
            // |currPrice - prevPrice| / prevPrice * 1000000
            uint256 absChange;
            if (currPrice > prevPrice) {
                absChange = FullMath.mulDiv(currPrice - prevPrice, 1000000, prevPrice);
            } else {
                absChange = FullMath.mulDiv(prevPrice - currPrice, 1000000, prevPrice);
            }

            sumAbsChanges += absChange;
            validSamples++;
        }

        if (validSamples == 0) return 0;

        // Average absolute change (scaled by 1000000)
        uint256 avgChange = sumAbsChanges / validSamples;

        // Convert to percentage (1% = 10000)
        // avgChange is in millionths, convert to basis points
        return avgChange / 100; // 1000000 / 100 = 10000 (1%)
    }

    /// @notice Calculates dynamic fee based on volatility
    /// @dev Higher volatility = higher fee
    function _calculateDynamicFee(uint256 volatility) internal pure returns (uint24) {
        if (volatility < LOW_VOLATILITY_THRESHOLD) {
            // Low volatility: reduce fee
            return MIN_FEE;
        } else if (volatility < HIGH_VOLATILITY_THRESHOLD) {
            // Medium volatility: base fee
            return BASE_FEE;
        } else {
            // High volatility: increase fee proportionally
            // Fee scales from BASE_FEE to MAX_FEE as volatility increases
            uint256 excessVolatility = volatility - HIGH_VOLATILITY_THRESHOLD;
            uint256 maxExcess = 100000 - HIGH_VOLATILITY_THRESHOLD; // Up to 10%

            uint256 feeIncrease = FullMath.mulDiv(excessVolatility, MAX_FEE - BASE_FEE, maxExcess);

            uint24 dynamicFee = BASE_FEE + uint24(feeIncrease);

            // Cap at MAX_FEE
            return dynamicFee > MAX_FEE ? MAX_FEE : dynamicFee;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get current fee for a pool
    function getFee(bytes32 poolId) external view returns (uint24) {
        return currentFee[poolId];
    }

    /// @notice Get current volatility for a pool
    function getVolatility(bytes32 poolId) external view returns (uint256) {
        if (sampleCount[poolId] < 2) return 0;
        return _calculateVolatility(poolId);
    }

    /// @notice Get price history for a pool
    function getPriceHistory(bytes32 poolId) external view returns (uint160[SAMPLE_SIZE] memory) {
        return priceHistory[poolId];
    }

}

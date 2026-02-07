// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FullMath} from "./FullMath.sol";

/// @title Position
/// @notice Positions represent an owner's liquidity between a lower and upper tick boundary
/// @dev Positions store additional state for tracking fees owed to the position
library Position {
    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Information stored for each user's position
    struct Info {
        // the amount of liquidity owned by this position
        uint128 liquidity;
        // fee growth per unit of liquidity as of the last update to liquidity or fees owed
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // the fees owed to the position owner in token0/token1
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error PositionNotCleared();

    // ══════════════════════════════════════════════════════════════════════
    // FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the Info struct of a position, given an owner and position boundaries
    /// @param self The mapping containing all user positions
    /// @param owner The address of the position owner
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// @return position The position info struct of the given owners' position
    function get(mapping(bytes32 => Info) storage self, address owner, int24 tickLower, int24 tickUpper)
        internal
        view
        returns (Info storage position)
    {
        position = self[keccak256(abi.encodePacked(owner, tickLower, tickUpper))];
    }

    /// @notice Credits accumulated fees to a user's position
    /// @param self The individual position to update
    /// @param liquidityDelta The change in pool liquidity as a result of the position update
    /// @param feeGrowthInside0X128 The all-time fee growth in token0, per unit of liquidity, inside the position's tick boundaries
    /// @param feeGrowthInside1X128 The all-time fee growth in token1, per unit of liquidity, inside the position's tick boundaries
    function update(
        Info storage self,
        int128 liquidityDelta,
        uint256 feeGrowthInside0X128,
        uint256 feeGrowthInside1X128
    ) internal {
        Info memory _self = self;

        uint128 tokensOwed0;
        uint128 tokensOwed1;

        // If we have existing liquidity, calculate fees owed
        if (_self.liquidity > 0) {
            tokensOwed0 = uint128(
                FullMath.mulDiv(
                    feeGrowthInside0X128 - _self.feeGrowthInside0LastX128, _self.liquidity, 0x100000000000000000000000000000000
                )
            );
            tokensOwed1 = uint128(
                FullMath.mulDiv(
                    feeGrowthInside1X128 - _self.feeGrowthInside1LastX128, _self.liquidity, 0x100000000000000000000000000000000
                )
            );

            self.tokensOwed0 += tokensOwed0;
            self.tokensOwed1 += tokensOwed1;
        }

        // Update liquidity and fee growth
        self.liquidity = liquidityDelta < 0
            ? _self.liquidity - uint128(-liquidityDelta)
            : _self.liquidity + uint128(liquidityDelta);
        self.feeGrowthInside0LastX128 = feeGrowthInside0X128;
        self.feeGrowthInside1LastX128 = feeGrowthInside1X128;
    }

    /// @notice Clears a position by removing all liquidity and fees
    /// @param self The position to clear
    function clear(Info storage self) internal {
        if (self.liquidity != 0) revert PositionNotCleared();
        delete self.feeGrowthInside0LastX128;
        delete self.feeGrowthInside1LastX128;
        delete self.tokensOwed0;
        delete self.tokensOwed1;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";

/// @title BaseHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Abstract base contract for implementing pool hooks
/// @dev Provides base functionality and permission checks for hooks
abstract contract BaseHook is IHooks {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error HookNotImplemented();
    error InvalidHookResponse();

    // ══════════════════════════════════════════════════════════════════════
    // HOOK PERMISSIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the hook permissions for this contract
    /// @dev Override in child contracts to specify which hooks are active
    function getHookPermissions() external pure virtual returns (Permissions memory);

    struct Permissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeModifyLiquidity;
        bool afterModifyLiquidity;
        bool beforeSwap;
        bool afterSwap;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS (Override as needed)
    // ══════════════════════════════════════════════════════════════════════

    function beforeInitialize(address, PoolKey calldata, uint160) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeModifyLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterModifyLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, BalanceDelta)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    // ══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Validates that the hook response matches the expected selector
    function _validateHookResponse(bytes4 response, bytes4 expected) internal pure {
        if (response != expected) revert InvalidHookResponse();
    }
}

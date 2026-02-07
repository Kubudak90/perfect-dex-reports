// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title TimelockAdmin
/// @author BaseBook Team (Solidity Researcher)
/// @notice TimelockController wrapper for BaseBook DEX admin operations
/// @dev Uses OpenZeppelin's TimelockController to enforce a mandatory delay on all
///      administrative actions. Designed to work with a Gnosis Safe multisig as the
///      proposer/executor for maximum security.
///
///      Architecture:
///        Gnosis Safe (multisig) --[proposes]--> TimelockAdmin --[executes after delay]--> Hook/PoolManager
///
///      The minimum delay ensures users have time to react to governance changes before
///      they take effect (e.g., fee changes, ownership transfers, parameter updates).
contract TimelockAdmin is TimelockController {
    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Minimum delay for all operations (24 hours)
    uint256 public constant MIN_TIMELOCK_DELAY = 86400; // 24 hours

    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Thrown when the initial delay is below the minimum
    error DelayBelowMinimum(uint256 provided, uint256 minimum);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Deploys the TimelockAdmin with the given delay and role assignments
    /// @param minDelay The minimum delay (in seconds) before operations can be executed.
    ///        Must be >= MIN_TIMELOCK_DELAY (86400 = 24 hours).
    /// @param proposers Addresses granted the PROPOSER_ROLE (typically a Gnosis Safe multisig).
    ///        Proposers can also cancel operations (CANCELLER_ROLE is auto-granted).
    /// @param executors Addresses granted the EXECUTOR_ROLE. Use address(0) to allow
    ///        anyone to execute once the delay has passed (open executor role).
    /// @param admin Optional admin address for initial configuration. Should be set to
    ///        address(0) in production so the timelock is fully self-governed.
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        if (minDelay < MIN_TIMELOCK_DELAY) {
            revert DelayBelowMinimum(minDelay, MIN_TIMELOCK_DELAY);
        }
    }
}

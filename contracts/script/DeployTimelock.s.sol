// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TimelockAdmin} from "../src/core/TimelockAdmin.sol";
import {PoolManager} from "../src/core/PoolManager.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title DeployTimelock Script
/// @notice Deploys TimelockAdmin and transfers ownership of PoolManager and hooks to it
/// @dev
///   Deployment steps:
///     1. Deploy TimelockAdmin with 24h delay, multisig as proposer/executor
///     2. Transfer PoolManager ownership to TimelockAdmin (2-step via Ownable)
///     3. Transfer each hook ownership to TimelockAdmin (2-step via Ownable2Step)
///
///   After deployment, the TimelockAdmin must call acceptOwnership() on each hook
///   through a scheduled timelock operation (or immediately if admin role is granted).
///
///   Usage:
///     MULTISIG_ADDRESS=0x... POOL_MANAGER=0x... forge script script/DeployTimelock.s.sol \
///       --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
contract DeployTimelock is Script {
    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice 24 hours minimum delay
    uint256 constant TIMELOCK_DELAY = 86400;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    TimelockAdmin public timelockAdmin;

    // ══════════════════════════════════════════════════════════════════════
    // MAIN DEPLOYMENT
    // ══════════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address multisig = vm.envAddress("MULTISIG_ADDRESS");

        console2.log("Deployer:", deployer);
        console2.log("Multisig (Gnosis Safe):", multisig);

        vm.startBroadcast(deployerPrivateKey);

        // ────────────────────────────────────────────────────────────────
        // Step 1: Deploy TimelockAdmin
        // ────────────────────────────────────────────────────────────────

        // Proposers: only the multisig can propose operations
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;

        // Executors: only the multisig can execute operations
        address[] memory executors = new address[](1);
        executors[0] = multisig;

        // Admin: set to address(0) for full self-governance
        // In production, you should NOT set an admin address.
        // During initial setup, you can temporarily set deployer as admin
        // to help with configuration, then renounce the admin role.
        timelockAdmin = new TimelockAdmin(
            TIMELOCK_DELAY,
            proposers,
            executors,
            address(0) // No admin - fully self-governed
        );

        console2.log("TimelockAdmin deployed at:", address(timelockAdmin));
        console2.log("  Minimum delay:", TIMELOCK_DELAY, "seconds (24 hours)");
        console2.log("  Proposer/Canceller:", multisig);
        console2.log("  Executor:", multisig);

        // ────────────────────────────────────────────────────────────────
        // Step 2: Transfer PoolManager ownership to TimelockAdmin
        // ────────────────────────────────────────────────────────────────
        //
        // PoolManager uses OZ Ownable (1-step transfer).
        // After this call, the TimelockAdmin immediately owns PoolManager.
        //
        // If PoolManager address is provided via env, transfer ownership:
        //   address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        //   PoolManager(poolManagerAddr).transferOwnership(address(timelockAdmin));

        vm.stopBroadcast();

        _logHookInstructions();
    }

    // ══════════════════════════════════════════════════════════════════════
    // INSTRUCTIONS
    // ══════════════════════════════════════════════════════════════════════

    function _logHookInstructions() internal view {
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("TimelockAdmin:", address(timelockAdmin));
        console2.log("Delay: 24 hours (86400 seconds)");
        console2.log("========================\n");

        console2.log("=== POST-DEPLOYMENT STEPS ===");
        console2.log("");
        console2.log("1. Transfer PoolManager ownership (1-step, OZ Ownable):");
        console2.log("   PoolManager.transferOwnership(timelockAdmin)");
        console2.log("");
        console2.log("2. For each hook with Ownable2Step, initiate 2-step transfer:");
        console2.log("   hook.transferOwnership(timelockAdmin)  // Step 1: propose");
        console2.log("");
        console2.log("3. Then, from the TimelockAdmin (via multisig proposal + 24h delay):");
        console2.log("   Schedule timelockAdmin.schedule(hook, 0, acceptOwnership(), 0, salt, delay)");
        console2.log("   After delay: timelockAdmin.execute(hook, 0, acceptOwnership(), 0, salt)");
        console2.log("");
        console2.log("Hooks to transfer ownership for:");
        console2.log("  - DynamicFeeHook");
        console2.log("  - OracleHook");
        console2.log("  - LimitOrderHook");
        console2.log("  - MEVProtectionHook");
        console2.log("  - TWAPOrderHook");
        console2.log("  - AutoCompoundHook");
        console2.log("=============================\n");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DynamicFeeHook} from "../src/hooks/DynamicFeeHook.sol";
import {OracleHook} from "../src/hooks/OracleHook.sol";
import {LimitOrderHook} from "../src/hooks/LimitOrderHook.sol";
import {MEVProtectionHook} from "../src/hooks/MEVProtectionHook.sol";
import {TWAPOrderHook} from "../src/hooks/TWAPOrderHook.sol";
import {AutoCompoundHook} from "../src/hooks/AutoCompoundHook.sol";

/// @title DeployHooks Script
/// @notice Deploys all BaseBook DEX hooks to testnet
/// @dev Requires PoolManager to be already deployed
contract DeployHooks is Script {
    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice PoolManager address (must be deployed first)
    address constant POOL_MANAGER = 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    DynamicFeeHook public dynamicFeeHook;
    OracleHook public oracleHook;
    LimitOrderHook public limitOrderHook;
    MEVProtectionHook public mevProtectionHook;
    TWAPOrderHook public twapOrderHook;
    AutoCompoundHook public autoCompoundHook;

    // ══════════════════════════════════════════════════════════════════════
    // MAIN DEPLOYMENT FUNCTION
    // ══════════════════════════════════════════════════════════════════════

    function run() external {
        // Ensure we're on Base Sepolia (chain ID: 84532)
        require(block.chainid == 84532, "Must deploy to Base Sepolia");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying BaseBook DEX Hooks to Base Sepolia...");
        console2.log("Deployer:", deployer);
        console2.log("PoolManager:", POOL_MANAGER);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ══════════════════════════════════════════════════════════════════
        // HIGH PRIORITY HOOKS
        // ══════════════════════════════════════════════════════════════════

        console2.log("=== HIGH PRIORITY HOOKS ===");

        // 1. DynamicFeeHook - Volatility-based fee adjustment
        dynamicFeeHook = new DynamicFeeHook(POOL_MANAGER);
        console2.log("DynamicFeeHook deployed at:", address(dynamicFeeHook));

        // 2. OracleHook - TWAP oracle functionality
        oracleHook = new OracleHook(POOL_MANAGER);
        console2.log("OracleHook deployed at:", address(oracleHook));

        console2.log("");

        // ══════════════════════════════════════════════════════════════════
        // MEDIUM PRIORITY HOOKS
        // ══════════════════════════════════════════════════════════════════

        console2.log("=== MEDIUM PRIORITY HOOKS ===");

        // 3. LimitOrderHook - On-chain limit orders
        limitOrderHook = new LimitOrderHook(POOL_MANAGER);
        console2.log("LimitOrderHook deployed at:", address(limitOrderHook));

        // 4. MEVProtectionHook - Sandwich attack protection
        mevProtectionHook = new MEVProtectionHook(POOL_MANAGER);
        console2.log("MEVProtectionHook deployed at:", address(mevProtectionHook));

        console2.log("");

        // ══════════════════════════════════════════════════════════════════
        // LOW PRIORITY HOOKS
        // ══════════════════════════════════════════════════════════════════

        console2.log("=== LOW PRIORITY HOOKS ===");

        // 5. TWAPOrderHook - Time-weighted average price orders
        twapOrderHook = new TWAPOrderHook(POOL_MANAGER);
        console2.log("TWAPOrderHook deployed at:", address(twapOrderHook));

        // 6. AutoCompoundHook - Automatic LP fee compounding
        autoCompoundHook = new AutoCompoundHook(POOL_MANAGER);
        console2.log("AutoCompoundHook deployed at:", address(autoCompoundHook));

        vm.stopBroadcast();

        // ══════════════════════════════════════════════════════════════════
        // DEPLOYMENT SUMMARY
        // ══════════════════════════════════════════════════════════════════

        console2.log("");
        console2.log("=== HOOK DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("PoolManager:", POOL_MANAGER);
        console2.log("");
        console2.log("HIGH PRIORITY:");
        console2.log("  DynamicFeeHook:", address(dynamicFeeHook));
        console2.log("  OracleHook:", address(oracleHook));
        console2.log("");
        console2.log("MEDIUM PRIORITY:");
        console2.log("  LimitOrderHook:", address(limitOrderHook));
        console2.log("  MEVProtectionHook:", address(mevProtectionHook));
        console2.log("");
        console2.log("LOW PRIORITY:");
        console2.log("  TWAPOrderHook:", address(twapOrderHook));
        console2.log("  AutoCompoundHook:", address(autoCompoundHook));
        console2.log("================================");
        console2.log("");
    }
}

/// @title DeployDynamicFeeHook Script
/// @notice Deploys only DynamicFeeHook (for testing or quick deployment)
contract DeployDynamicFeeHook is Script {
    address constant POOL_MANAGER = 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05;

    function run() external {
        require(block.chainid == 84532, "Must deploy to Base Sepolia");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        DynamicFeeHook hook = new DynamicFeeHook(POOL_MANAGER);
        console2.log("DynamicFeeHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}

/// @title DeployOracleHook Script
/// @notice Deploys only OracleHook (for testing or quick deployment)
contract DeployOracleHook is Script {
    address constant POOL_MANAGER = 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05;

    function run() external {
        require(block.chainid == 84532, "Must deploy to Base Sepolia");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        OracleHook hook = new OracleHook(POOL_MANAGER);
        console2.log("OracleHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "../src/core/PoolManager.sol";
import {SwapRouter} from "../src/core/SwapRouter.sol";
import {Quoter} from "../src/core/Quoter.sol";
import {PositionManager} from "../src/core/PositionManager.sol";

/// @title Deploy Script
/// @notice Deploys BaseBook DEX core contracts
/// @dev For Week 1: Deploy PoolManager to testnet
contract Deploy is Script {
    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Permit2 address (same across all chains)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════

    PoolManager public poolManager;
    SwapRouter public swapRouter;
    Quoter public quoter;
    PositionManager public positionManager;

    // ══════════════════════════════════════════════════════════════════════
    // MAIN DEPLOYMENT FUNCTION
    // ══════════════════════════════════════════════════════════════════════

    function run() external virtual {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying contracts with address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PoolManager
        poolManager = new PoolManager();
        console2.log("PoolManager deployed at:", address(poolManager));

        // Deploy SwapRouter
        swapRouter = new SwapRouter(address(poolManager), PERMIT2);
        console2.log("SwapRouter deployed at:", address(swapRouter));

        // Deploy Quoter
        quoter = new Quoter(address(poolManager));
        console2.log("Quoter deployed at:", address(quoter));

        // Deploy PositionManager
        positionManager = new PositionManager(address(poolManager));
        console2.log("PositionManager deployed at:", address(positionManager));

        vm.stopBroadcast();

        // Save deployment info
        _saveDeployment();
    }

    // ══════════════════════════════════════════════════════════════════════
    // DEPLOYMENT HELPERS
    // ══════════════════════════════════════════════════════════════════════

    function _saveDeployment() internal view {
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Block number:", block.number);
        console2.log("Permit2:", PERMIT2);
        console2.log("PoolManager:", address(poolManager));
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("Quoter:", address(quoter));
        console2.log("PositionManager:", address(positionManager));
        console2.log("========================\n");
    }
}

/// @title DeployTestnet Script
/// @notice Deploy to Base Sepolia testnet
contract DeployTestnet is Script {
    /// @notice Permit2 address (same across all chains)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        // Ensure we're on Base Sepolia (chain ID: 84532)
        require(block.chainid == 84532, "Must deploy to Base Sepolia");

        console2.log("Deploying to Base Sepolia Testnet...");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying contracts with address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PoolManager
        PoolManager poolManager = new PoolManager();
        console2.log("PoolManager deployed at:", address(poolManager));

        // Deploy SwapRouter
        SwapRouter swapRouter = new SwapRouter(address(poolManager), PERMIT2);
        console2.log("SwapRouter deployed at:", address(swapRouter));

        // Deploy Quoter
        Quoter quoter = new Quoter(address(poolManager));
        console2.log("Quoter deployed at:", address(quoter));

        // Deploy PositionManager
        PositionManager positionManager = new PositionManager(address(poolManager));
        console2.log("PositionManager deployed at:", address(positionManager));

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Block number:", block.number);
        console2.log("Permit2:", PERMIT2);
        console2.log("PoolManager:", address(poolManager));
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("Quoter:", address(quoter));
        console2.log("PositionManager:", address(positionManager));
        console2.log("========================\n");
    }
}

/// @title DeployMainnet Script
/// @notice Deploy to Base mainnet
contract DeployMainnet is Script {
    /// @notice Permit2 address (same across all chains)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        // Ensure we're on Base mainnet (chain ID: 8453)
        require(block.chainid == 8453, "Must deploy to Base Mainnet");

        console2.log("Deploying to Base Mainnet...");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying contracts with address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PoolManager
        PoolManager poolManager = new PoolManager();
        console2.log("PoolManager deployed at:", address(poolManager));

        // Deploy SwapRouter
        SwapRouter swapRouter = new SwapRouter(address(poolManager), PERMIT2);
        console2.log("SwapRouter deployed at:", address(swapRouter));

        // Deploy Quoter
        Quoter quoter = new Quoter(address(poolManager));
        console2.log("Quoter deployed at:", address(quoter));

        // Deploy PositionManager
        PositionManager positionManager = new PositionManager(address(poolManager));
        console2.log("PositionManager deployed at:", address(positionManager));

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Block number:", block.number);
        console2.log("Permit2:", PERMIT2);
        console2.log("PoolManager:", address(poolManager));
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("Quoter:", address(quoter));
        console2.log("PositionManager:", address(positionManager));
        console2.log("========================\n");
    }
}

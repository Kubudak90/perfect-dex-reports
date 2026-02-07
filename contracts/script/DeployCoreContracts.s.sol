// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "../src/core/PoolManager.sol";
import {SwapRouter} from "../src/core/SwapRouter.sol";
import {Quoter} from "../src/core/Quoter.sol";
import {PositionManager} from "../src/core/PositionManager.sol";

/// @title DeployCoreContracts
/// @notice Deploys all core contracts for BaseBook DEX
contract DeployCoreContracts is Script {
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== DEPLOYING CORE CONTRACTS ===");
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("Chain ID:", block.chainid);
        console2.log("================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PoolManager (no constructor args)
        PoolManager poolManager = new PoolManager();
        console2.log("PoolManager deployed at:", address(poolManager));

        // 2. Deploy SwapRouter (requires PoolManager and Permit2)
        SwapRouter swapRouter = new SwapRouter(address(poolManager), PERMIT2);
        console2.log("SwapRouter deployed at:", address(swapRouter));

        // 3. Deploy Quoter (requires PoolManager)
        Quoter quoter = new Quoter(address(poolManager));
        console2.log("Quoter deployed at:", address(quoter));

        // 4. Deploy PositionManager (requires PoolManager)
        PositionManager positionManager = new PositionManager(address(poolManager));
        console2.log("PositionManager deployed at:", address(positionManager));

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT COMPLETE ===");
        console2.log("PoolManager:", address(poolManager));
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("Quoter:", address(quoter));
        console2.log("PositionManager:", address(positionManager));
        console2.log("Permit2:", PERMIT2);
        console2.log("===========================\n");
    }
}

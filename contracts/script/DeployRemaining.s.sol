// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "../src/core/PoolManager.sol";
import {SwapRouter} from "../src/core/SwapRouter.sol";
import {Quoter} from "../src/core/Quoter.sol";
import {PositionManager} from "../src/core/PositionManager.sol";

contract DeployRemaining is Script {
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant POOL_MANAGER = 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying remaining contracts...");
        console2.log("Deployer:", deployer);
        console2.log("PoolManager:", POOL_MANAGER);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SwapRouter
        SwapRouter swapRouter = new SwapRouter(POOL_MANAGER, PERMIT2);
        console2.log("SwapRouter deployed at:", address(swapRouter));

        // Deploy Quoter
        Quoter quoter = new Quoter(POOL_MANAGER);
        console2.log("Quoter deployed at:", address(quoter));

        // Deploy PositionManager
        PositionManager positionManager = new PositionManager(POOL_MANAGER);
        console2.log("PositionManager deployed at:", address(positionManager));

        vm.stopBroadcast();

        console2.log("\n=== FULL DEPLOYMENT SUMMARY ===");
        console2.log("PoolManager:", POOL_MANAGER);
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("Quoter:", address(quoter));
        console2.log("PositionManager:", address(positionManager));
        console2.log("================================\n");
    }
}

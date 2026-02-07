// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "../src/core/PoolManager.sol";

contract DeploySimple is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying PoolManager...");
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        PoolManager poolManager = new PoolManager();
        console2.log("PoolManager deployed at:", address(poolManager));

        vm.stopBroadcast();
    }
}

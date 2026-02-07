// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DynamicFeeHook} from "../src/hooks/DynamicFeeHook.sol";

contract DeployDynamicFee is Script {
    address constant POOL_MANAGER = 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("Deploying DynamicFeeHook...");
        console2.log("PoolManager:", POOL_MANAGER);

        vm.startBroadcast(deployerPrivateKey);

        DynamicFeeHook hook = new DynamicFeeHook(POOL_MANAGER);
        console2.log("DynamicFeeHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}

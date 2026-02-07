// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Quoter} from "../src/core/Quoter.sol";

contract DeployQuoter is Script {
    address constant POOL_MANAGER = 0x9D080a250CE674A88EA8b4160D7E67D1F122D008;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Quoter quoter = new Quoter(POOL_MANAGER);
        console2.log("Quoter deployed at:", address(quoter));

        vm.stopBroadcast();
    }
}

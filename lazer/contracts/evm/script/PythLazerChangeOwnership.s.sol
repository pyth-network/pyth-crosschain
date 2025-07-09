// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract PythLazerChangeOwnership is Script {
    address public constant LAZER_PROXY_ADDRESS =
        address(0xACeA761c27A909d4D3895128EBe6370FDE2dF481);

    uint256 public OLD_OWNER_PRIVATE_KEY = vm.envUint("DEPLOYER_PRIVATE_KEY");
    address public OLD_OWNER = vm.addr(OLD_OWNER_PRIVATE_KEY);
    // EVM Executor Contract
    address public NEW_OWNER = vm.envAddress("NEW_OWNER");

    function run() public {
        console.log("Old owner: %s", OLD_OWNER);
        console.log("New owner: %s", NEW_OWNER);
        console.log("Lazer proxy address: %s", LAZER_PROXY_ADDRESS);
        console.log("Lazer owner: %s", PythLazer(LAZER_PROXY_ADDRESS).owner());
        console.log("Moving ownership from %s to %s", OLD_OWNER, NEW_OWNER);

        PythLazer lazer = PythLazer(LAZER_PROXY_ADDRESS);
        vm.startBroadcast(OLD_OWNER_PRIVATE_KEY);
        require(lazer.owner() == OLD_OWNER, "Old owner mismatch");
        lazer.transferOwnership(NEW_OWNER);
        console.log("Ownership transferred");
        console.log(
            "New Lazer owner: %s",
            PythLazer(LAZER_PROXY_ADDRESS).owner()
        );
        vm.stopBroadcast();
    }
}

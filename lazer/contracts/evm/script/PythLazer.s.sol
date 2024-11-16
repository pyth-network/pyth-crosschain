// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PythLazer} from "../src/PythLazer.sol";

contract PythLazerScript is Script {
    PythLazer public pythLazer;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        pythLazer = new PythLazer();
        pythLazer.initialize(address(1));

        vm.stopBroadcast();
    }
}

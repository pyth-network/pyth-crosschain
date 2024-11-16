// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {PythLazer} from "../src/PythLazer.sol";

contract PythLazerTest is Test {
    PythLazer public pythLazer;

    function setUp() public {
        pythLazer = new PythLazer();
        pythLazer.initialize(address(1));
    }

    function test_update() public {
        assert(!pythLazer.isValidSigner(address(2)));
        vm.prank(address(1));
        pythLazer.updateTrustedSigner(address(2), block.timestamp + 1000);
        assert(pythLazer.isValidSigner(address(2)));
        skip(2000);
        assert(!pythLazer.isValidSigner(address(2)));
    }
}

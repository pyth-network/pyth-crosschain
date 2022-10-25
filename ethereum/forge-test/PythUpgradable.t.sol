// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../contracts/pyth/PythUpgradable.sol";
import "forge-std/Test.sol";

contract TestPythUpgradable is Test {
    PythUpgradable public pyth;

    function setUp() public {
        pyth = new PythUpgradable();
        // The values below are just dummy values and this test does nothing.
        pyth.initialize(
            address(0x0000000000000000000000000000000000000000000000000000000000000000),
            0,
            0x0000000000000000000000000000000000000000000000000000000000000000
        );
    }
}

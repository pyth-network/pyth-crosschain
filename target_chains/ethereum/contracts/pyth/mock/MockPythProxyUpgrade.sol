// contracts/Implementation.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../PythUpgradable.sol";

contract MockPythUpgrade is PythUpgradable {
    function isUpgradeActive() external pure returns (bool) {
        return true;
    }
}

// contracts/Implementation.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../PythProxy.sol";

contract MockPythProxyUpgrade is PythProxy {
    function isUpgradeActive() external pure returns (bool) {
        return true;
    }
}

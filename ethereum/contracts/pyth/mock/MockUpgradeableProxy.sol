// contracts/Implementation.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MockUpgradeableProxy is UUPSUpgradeable {
    function isUpgradeActive() external pure returns (bool) {
        return true;
    }

    function _authorizeUpgrade(address) internal override {}
}

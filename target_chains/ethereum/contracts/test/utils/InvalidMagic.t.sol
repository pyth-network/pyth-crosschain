// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract InvalidMagic is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    // /// Ensures the contract cannot be uninitialized and taken over.
    // /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function entropyUpgradableMagic() public pure returns (uint32) {
        return 0x000000;
    }
}

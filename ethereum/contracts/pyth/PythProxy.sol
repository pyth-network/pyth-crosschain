// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./Pyth.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PythProxy is Initializable, OwnableUpgradeable, UUPSUpgradeable, Pyth {

    function initialize(
        uint16 chainId,
        address wormhole,
        uint16 pyth2WormholeChainId,
        bytes32 pyth2WormholeEmitter
    ) initializer override public {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Pyth.initialize(chainId, wormhole, pyth2WormholeChainId, pyth2WormholeEmitter);
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

}

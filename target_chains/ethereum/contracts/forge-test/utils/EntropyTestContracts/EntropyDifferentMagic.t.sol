// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

contract EntropyDifferentMagic is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    // /// Ensures the contract cannot be uninitialized and taken over.
    // /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function magicCheck() internal view {
        // Calling a method using `this.<method>` will cause a contract call that will use
        // the new contract. This call will fail if the method does not exists or the magic
        // is different.
        if (this.entropyUpgradableMagic() != 0x666972)
            revert EntropyErrors.InvalidUpgradeMagic();
    }

    function entropyUpgradableMagic() public pure returns (uint32) {
        return 0x666972;
    }
}

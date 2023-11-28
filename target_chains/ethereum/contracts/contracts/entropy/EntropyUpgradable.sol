// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyGovernance.sol";
import "./Entropy.sol";

contract EntropyUpgradable is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Entropy,
    EntropyGovernance
{
    function initialize(
        address admin,
        uint pythFeeInWei,
        address defaultProvider
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Entropy._initialize(admin, pythFeeInWei, defaultProvider);

        renounceOwnership();
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    // The contract has no owner so this function will always revert
    // but UUPSUpgradeable expects this method to be implemented.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function pythUpgradableMagic() public pure returns (uint32) {
        // FIXME: do we need to change this?
        return 0x97a6f304;
    }

    // Execute a UpgradeContract governance message
    function upgradeUpgradableContract(
        UpgradeContractPayload memory payload
    ) internal override {
        address oldImplementation = _getImplementation();
        _upgradeToAndCallUUPS(payload.newImplementation, new bytes(0), false);

        // Calling a method using `this.<method>` will cause a contract call that will use
        // the new contract. This call will fail if the method does not exists or the magic
        // is different.
        if (this.pythUpgradableMagic() != 0x97a6f304)
            revert EntropyErrors.InvalidGovernanceMessage();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }
}

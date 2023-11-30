// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "../../../contracts/entropy/EntropyGovernance.sol";
import "../../../contracts/entropy/Entropy.sol";

contract EntropyDifferentMagic is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Entropy,
    EntropyGovernance
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    // The contract will have an owner and an admin
    // The owner will have all the power over it.
    // The admin can set some config parameters only.
    function initialize(
        address owner,
        address admin,
        uint128 pythFeeInWei,
        address defaultProvider,
        bool prefillRequestStorage
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Entropy._initialize(
            admin,
            pythFeeInWei,
            defaultProvider,
            prefillRequestStorage
        );

        // We need to transfer the ownership from deployer to the new owner
        transferOwnership(owner);
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // There are some actions which both and admin and owner can perform
    function _authoriseAdminAction() internal view override {
        if (msg.sender != owner() && msg.sender != _state.admin)
            revert EntropyErrors.Unauthorized();
    }

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

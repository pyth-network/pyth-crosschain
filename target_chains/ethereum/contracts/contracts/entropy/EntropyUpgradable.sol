// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyGovernance.sol";
import "./Entropy.sol";

contract EntropyUpgradable is
    Initializable,
    Ownable2StepUpgradeable,
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
        require(owner != address(0), "owner is zero address");
        require(admin != address(0), "admin is zero address");
        require(
            defaultProvider != address(0),
            "defaultProvider is zero address"
        );

        __Ownable_init();
        __UUPSUpgradeable_init();

        Entropy._initialize(
            admin,
            pythFeeInWei,
            defaultProvider,
            prefillRequestStorage
        );

        // We need to transfer the ownership from deployer to the new owner
        _transferOwnership(owner);
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

    // We have not overridden these methods in Pyth contracts implementation.
    // But we are overriding them here because there was no owner before and
    // `_authorizeUpgrade` would cause a revert for these. Now we have an owner, and
    // because we want to test for the magic. We are overriding these methods.
    function upgradeTo(address newImplementation) external override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);

        magicCheck();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);

        magicCheck();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    function magicCheck() internal view {
        // Calling a method using `this.<method>` will cause a contract call that will use
        // the new contract. This call will fail if the method does not exists or the magic
        // is different.
        if (this.entropyUpgradableMagic() != 0x66697265)
            revert EntropyErrors.InvalidUpgradeMagic();
    }

    function entropyUpgradableMagic() public pure returns (uint32) {
        return 0x66697265;
    }

    function version() public pure returns (string memory) {
        return "2.0.0";
    }
}

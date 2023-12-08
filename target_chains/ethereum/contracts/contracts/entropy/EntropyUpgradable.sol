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
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    event TransferOwnershipRequested(address oldOwner, address newOwner);
    event OwnershipClaimed(address oldOwner, address newOwner);

    // The contract will have an owner and an admin
    // The owner will have all the power over it.
    // The admin can set some config parameters only.
    function initialize(
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

    //  Disabling transferOwnership as we don't want the owner to directly
    //  transfer ownership to another address.
    //  See `transferTo` if you want to transfer ownership.
    function transferOwnership(address) public pure override {
        revert EntropyErrors.InvalidTransferCall();
    }

    // Current owner can raise an ownership transfer request to another account
    function transferTo(address account) external onlyOwner {
        _state.ownershipTransferAccount = account;
        emit TransferOwnershipRequested(owner(), account);
    }

    // The account to which the ownership transfer request has been raised will need
    // to invoke this method to complete the transfer
    function acceptTransfer() external {
        if (_state.ownershipTransferAccount != msg.sender)
            revert EntropyErrors.Unauthorized();

        address oldOwner = owner();
        _transferOwnership(_state.ownershipTransferAccount);
        address newOwner = owner();
        emit OwnershipClaimed(oldOwner, newOwner);
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
}

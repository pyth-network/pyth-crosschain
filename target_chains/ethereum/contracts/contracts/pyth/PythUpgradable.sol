// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./Pyth.sol";
import "./PythInternalStructs.sol";
import "./PythGetters.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./PythGovernance.sol";
import "./Pyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

contract PythUpgradable is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Pyth,
    PythGovernance
{
    function initialize(
        address wormhole,
        uint16[] calldata dataSourceEmitterChainIds,
        bytes32[] calldata dataSourceEmitterAddresses,
        uint16 governanceEmitterChainId,
        bytes32 governanceEmitterAddress,
        uint64 governanceInitialSequence,
        uint validTimePeriodSeconds,
        uint singleUpdateFeeInWei
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Pyth._initialize(
            wormhole,
            dataSourceEmitterChainIds,
            dataSourceEmitterAddresses,
            governanceEmitterChainId,
            governanceEmitterAddress,
            governanceInitialSequence,
            validTimePeriodSeconds,
            singleUpdateFeeInWei
        );

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
        return 0x97a6f304;
    }

    /// The address of the `PythGovernanceModule` library linked into this
    /// implementation. Governance actions other than `UpgradeContract` are
    /// executed by `delegatecall`ing into it, so deployment tooling and proposal
    /// review can use this to confirm the link on-chain.
    function governanceModule() public pure returns (address) {
        return address(PythGovernanceModule);
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
            revert PythErrors.InvalidGovernanceMessage();

        // The new implementation only handles `UpgradeContract` on its own; every
        // other governance action lives in its linked governance module. Reject
        // the upgrade if that library is missing, so a mis-linked deployment
        // reverts here instead of bricking governance on the proxy.
        if (this.governanceModule().code.length == 0)
            revert PythErrors.InvalidGovernanceMessage();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }
}

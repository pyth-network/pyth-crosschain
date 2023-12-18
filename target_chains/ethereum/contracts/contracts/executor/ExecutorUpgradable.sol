// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./Executor.sol";

contract ExecutorUpgradable is
    Initializable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Executor
{
    function initialize(
        address wormhole,
        uint64 lastExecutedSequence,
        uint16 chainId,
        uint16 ownerEmitterChainId,
        bytes32 ownerEmitterAddress
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Executor._initialize(
            wormhole,
            lastExecutedSequence,
            chainId,
            ownerEmitterChainId,
            ownerEmitterAddress
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
        return 0x97a6f312;
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
        if (this.pythUpgradableMagic() != 0x97a6f312)
            revert PythErrors.InvalidGovernanceMessage();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }
}

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
        uint validTimePeriodSeconds,
        uint singleUpdateFeeInWei
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Pyth._initialize(
            wormhole,
            dataSourceEmitterChainIds,
            dataSourceEmitterAddresses,
            validTimePeriodSeconds,
            singleUpdateFeeInWei
        );
    }

    /// Privileged function to specify additional data sources in the contract
    function addDataSource(uint16 chainId, bytes32 emitter) public onlyOwner {
        PythInternalStructs.DataSource memory ds = PythInternalStructs
            .DataSource(chainId, emitter);
        require(
            !PythGetters.isValidDataSource(ds.chainId, ds.emitterAddress),
            "Data source already added"
        );

        _state.isValidDataSource[hashDataSource(ds)] = true;
        _state.validDataSources.push(ds);
    }

    /// Privileged fucntion to remove the specified data source. Assumes _state.validDataSources has no duplicates.
    function removeDataSource(
        uint16 chainId,
        bytes32 emitter
    ) public onlyOwner {
        PythInternalStructs.DataSource memory ds = PythInternalStructs
            .DataSource(chainId, emitter);
        require(
            PythGetters.isValidDataSource(ds.chainId, ds.emitterAddress),
            "Data source not found, not removing"
        );

        _state.isValidDataSource[hashDataSource(ds)] = false;

        for (uint i = 0; i < _state.validDataSources.length; ++i) {
            // Find the source to remove
            if (
                _state.validDataSources[i].chainId == ds.chainId ||
                _state.validDataSources[i].emitterAddress == ds.emitterAddress
            ) {
                // Copy last element to overwrite the target data source
                _state.validDataSources[i] = _state.validDataSources[
                    _state.validDataSources.length - 1
                ];
                // Remove the last element we just preserved
                _state.validDataSources.pop();

                break;
            }
        }
    }

    /// Privileged function to update the price update fee
    function updateSingleUpdateFeeInWei(uint newFee) public onlyOwner {
        PythSetters.setSingleUpdateFeeInWei(newFee);
    }

    /// Privileged function to update the valid time period for a price.
    function updateValidTimePeriodSeconds(
        uint newValidTimePeriodSeconds
    ) public onlyOwner {
        PythSetters.setValidTimePeriodSeconds(newValidTimePeriodSeconds);
    }

    // Privileged function to update the governance emitter
    function updateGovernanceDataSource(
        uint16 chainId,
        bytes32 emitter,
        uint64 sequence
    ) public onlyOwner {
        PythInternalStructs.DataSource memory ds = PythInternalStructs
            .DataSource(chainId, emitter);
        PythSetters.setGovernanceDataSource(ds);
        PythSetters.setLastExecutedGovernanceSequence(sequence);
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function pythUpgradableMagic() public pure returns (uint32) {
        return 0x97a6f304;
    }

    // Execute a UpgradeContract governance message
    function upgradeUpgradableContract(
        UpgradeContractPayload memory payload
    ) internal override {
        address oldImplementation = _getImplementation();
        _upgradeToAndCallUUPS(payload.newImplementation, new bytes(0), false);

        // Calling a method using `this.<method>` will cause a contract call that will use
        // the new contract.
        require(
            this.pythUpgradableMagic() == 0x97a6f304,
            "the new implementation is not a Pyth contract"
        );

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }
}

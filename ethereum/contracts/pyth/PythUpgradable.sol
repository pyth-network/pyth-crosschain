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


contract PythUpgradable is Initializable, OwnableUpgradeable, UUPSUpgradeable, Pyth, PythGovernance {
    function initialize(
        address wormhole,
        uint16 pyth2WormholeChainId,
        bytes32 pyth2WormholeEmitter
    ) initializer override public {
        __Ownable_init();
        __UUPSUpgradeable_init();

        Pyth.initialize(wormhole, pyth2WormholeChainId, pyth2WormholeEmitter);
    }

    /// Privileged function to specify additional data sources in the contract
    function addDataSource(uint16 chainId, bytes32 emitter) onlyOwner public {
        PythInternalStructs.DataSource memory ds = PythInternalStructs.DataSource(chainId, emitter);
        require(!PythGetters.isValidDataSource(ds.chainId, ds.emitterAddress), "Data source already added");

        _state.isValidDataSource[hashDataSource(ds)] = true;
        _state.validDataSources.push(ds);
    }

    /// Privileged fucntion to remove the specified data source. Assumes _state.validDataSources has no duplicates.
    function removeDataSource(uint16 chainId, bytes32 emitter) onlyOwner public {
        PythInternalStructs.DataSource memory ds = PythInternalStructs.DataSource(chainId, emitter);
        require(PythGetters.isValidDataSource(ds.chainId, ds.emitterAddress), "Data source not found, not removing");

        _state.isValidDataSource[hashDataSource(ds)] = false;

        for (uint i = 0; i < _state.validDataSources.length;  ++i) {

            // Find the source to remove
            if (_state.validDataSources[i].chainId == ds.chainId || _state.validDataSources[i].emitterAddress == ds.emitterAddress)  {

                // Copy last element to overwrite the target data source
                _state.validDataSources[i] = _state.validDataSources[_state.validDataSources.length - 1];
                // Remove the last element we just preserved
                _state.validDataSources.pop();


                break;
            }
        }
    }

    /// Privileged function to update the price update fee
    function updateSingleUpdateFeeInWei(uint newFee) onlyOwner public {
        PythSetters.setSingleUpdateFeeInWei(newFee);
    }

    /// Privileged function to update the valid time period for a price.
    function updateValidTimePeriodSeconds(uint newValidTimePeriodSeconds) onlyOwner public {
        PythSetters.setValidTimePeriodSeconds(newValidTimePeriodSeconds);
    }

    // Privileged function to update the governance emitter
    function updateGovernanceDataSource(uint16 chainId, bytes32 emitter, uint64 _sequence) onlyOwner public {
        PythInternalStructs.DataSource memory ds = PythInternalStructs.DataSource(chainId, emitter);
        PythSetters.setGovernanceDataSource(ds);
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // Execute a UpgradeContract governance message
    function upgradeUpgradableContract(UpgradeContractPayload memory payload) override internal {
        address oldImplementation = _getImplementation();
        _upgradeToAndCallUUPS(payload.newImplementation, new bytes(0), false);
        require(isPyth(), "the new implementation is not a Pyth contract");

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }
}

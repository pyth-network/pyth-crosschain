// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./ReceiverState.sol";

contract ReceiverSetters is ReceiverState {
    function setOwner(address owner_) internal {
        _state.owner = owner_;
    }
    
    function updateGuardianSetIndex(uint32 newIndex) internal {
        _state.guardianSetIndex = newIndex;
    }

    function expireGuardianSet(uint32 index) internal {
        _state.guardianSets[index].expirationTime = uint32(block.timestamp) + 86400;
    }

    function storeGuardianSet(ReceiverStructs.GuardianSet memory set, uint32 index) internal {
        _state.guardianSets[index] = set;
    }

    function setInitialized(address implementatiom) internal {
        _state.initializedImplementations[implementatiom] = true;
    }

    function setGovernanceActionConsumed(bytes32 hash) internal {
        _state.consumedGovernanceActions[hash] = true;
    }

    function setGovernanceChainId(uint16 chainId) internal {
        _state.provider.governanceChainId = chainId;
    }

    function setGovernanceContract(bytes32 governanceContract) internal {
        _state.provider.governanceContract = governanceContract;
    }

}

// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./ReceiverStructs.sol";

contract ReceiverEvents {
    event LogGuardianSetChanged(
        uint32 oldGuardianIndex,
        uint32 newGuardianIndex
    );

    event LogMessagePublished(
        address emitter_address,
        uint32 nonce,
        bytes payload
    );
}

contract ReceiverStorage {
    struct WormholeState {
        ReceiverStructs.Provider provider;
        // Mapping of guardian_set_index => guardian set
        mapping(uint32 => ReceiverStructs.GuardianSet) guardianSets;
        // Current active guardian set index
        uint32 guardianSetIndex;
        // Period for which a guardian set stays active after it has been replaced
        uint32 guardianSetExpiry;
        // Mapping of consumed governance actions
        mapping(bytes32 => bool) consumedGovernanceActions;
        // Mapping of initialized implementations
        mapping(address => bool) initializedImplementations;
    }
}

contract ReceiverState {
    ReceiverStorage.WormholeState _state;
}

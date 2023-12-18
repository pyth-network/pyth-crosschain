// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../pyth/PythGovernanceInstructions.sol";
import "../wormhole/interfaces/IWormhole.sol";

abstract contract ExecutorInternalStructs {
    struct State {
        IWormhole wormhole;
        uint64 lastExecutedSequence;
        uint16 chainId;
        uint16 ownerEmitterChainId;
        bytes32 ownerEmitterAddress;
    }
}

abstract contract ExecutorState {
    // Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
    // TODO: it's annoying that we can't import this from PythGovernanceInstructions
    uint32 constant MAGIC = 0x5054474d;

    PythGovernanceInstructions.GovernanceModule constant MODULE =
        PythGovernanceInstructions.GovernanceModule.EvmExecutor;

    ExecutorInternalStructs.State _state;
}

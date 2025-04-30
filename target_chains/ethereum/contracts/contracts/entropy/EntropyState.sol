// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

contract EntropyInternalStructs {
    struct State {
        // Admin has the rights to update pyth configs
        address admin;
        // Fee charged by the pyth protocol in wei.
        uint128 pythFeeInWei;
        // Total quantity of fees (in wei) earned by the pyth protocol that are currently stored in the contract.
        // This quantity is incremented when fees are paid and decremented when fees are withdrawn.
        // Note that u128 can store up to ~10^36 wei, which is ~10^18 in native base tokens, which should be plenty.
        uint128 accruedPythFeesInWei;
        // The protocol sets a provider as default to simplify integration for developers.
        address defaultProvider;
        // Hash table for storing in-flight requests. Table keys are hash(provider, sequenceNumber), and the value is
        // the current request (if one is currently in-flight).
        //
        // Due to the vagaries of EVM opcode costs, it is inefficient to simply use a mapping here. Overwriting zero-valued
        // storage slots with non-zero values is expensive in EVM (21k gas). Using a mapping, each new request starts
        // from all-zero values, and thus incurs a substantial write cost. Deleting non-zero values does refund gas, but
        // unfortunately the refund is not substantial enough to matter.
        //
        // This data structure is a two-level hash table. It first tries to store new requests in the requests array at
        // an index determined by a few bits of the request's key. If that slot in the array is already occupied by a
        // prior request, the prior request is evicted into the requestsOverflow mapping. Requests in the array are
        // considered active if their sequenceNumber is > 0.
        //
        // WARNING: the number of requests must be kept in sync with the constants below
        EntropyStructsV2.Request[32] requests;
        mapping(bytes32 => EntropyStructsV2.Request) requestsOverflow;
        // Mapping from randomness providers to information about each them.
        mapping(address => EntropyStructsV2.ProviderInfo) providers;
        // proposedAdmin is the new admin's account address proposed by either the owner or the current admin.
        // If there is no pending transfer request, this value will hold `address(0)`.
        address proposedAdmin;
        // Seed for in-contract PRNG. This seed is used to generate user random numbers in some callback flows.
        bytes32 seed;
    }
}

contract EntropyState {
    // The size of the requests hash table. Must be a power of 2.
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;

    EntropyInternalStructs.State _state;
}

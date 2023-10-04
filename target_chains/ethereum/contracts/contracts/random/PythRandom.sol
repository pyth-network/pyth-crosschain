// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythRandomState.sol";

// here’s a sketch of how this could work:
// 1. user generates a random number x and computed h = hash(x).
// 2. user submits h in a transaction to the pyth random number contract. the contract assigns an incrementing sequence number i to the request. the contract stores (h, i)
//an off chain service watches the contract to see which sequence numbers have been requested
//user queries the off chain service for the ith random number. the service returns the number y along with the merkle proof p. the service refuses to return this number unless the request for i has been submitted to the blockchain.
//user submits a transaction with (y, p, x, i). the pyth contract verifies that the proof p is valid for y,i and that hash(x) == h. the random number is then hash(y,x) (or you can xor them or whatever).
abstract contract PythRandom is PythRandomState {

    function register(uint feeInWei, bytes20 initialCommitment, uint64 commitmentEnd) public {
        if (_state.providers.contains(msg.sender)) revert AlreadyRegistered;
        _state.providers[msg.sender] = new PythRandomStructs.ProviderInfo(feeInWei, 0, initialCommitment, commitmentEnd, 0)
    }

    function rotate(bytes20 commitment, uint64 commitmentEnd) public {
        // TODO: are we guaranteed that this exists?
        PythRandomStructs.ProviderInfo provider = providers[msg.sender];
        provider.currentCommitment = commitment;
        provider.finalSequenceNumber = commitmentEnd;
        providers[msg.sender] = provider;
    }

    function requestRandomNumber(address provider, uint256 userCommitment) public payable returns (uint64 sequenceNumber) {
        bytes32 hash = hashRequest(new Request(provider, userCommitment, currentSequenceNumber));
        currentSequenceNumber += 1;

        // Need to handle case where we've run out of committed randomness

        // Need to check fees and handle accounting
    }

    function fulfillRequest(address provider, uint64 sequenceNumber, uint256 userRandomness, bytes calldata proof) returns (uint256 randomNumber) {
        Request request = lookupRequest(provider, sequenceNumber);

        uint256 providerRandomness = checkProofAndExtractNumber(proof, sequenceNumber, currentProviderRoot);
        assert(hash(userRandomness) == request.commitment);

        randomNumber = userReveal ^ providerRandomness;
    }

    function hashRequest(Request calldata request) {

    }

}

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythRandomState.sol";
import "./PythRandomErrors.sol";
import "../libraries/MerkleTree.sol";


// here’s a sketch of how this could work:
// 1. user generates a random number x and computed h = hash(x).
// 2. user submits h in a transaction to the pyth random number contract. the contract assigns an incrementing sequence number i to the request. the contract stores (h, i)
//an off chain service watches the contract to see which sequence numbers have been requested
//user queries the off chain service for the ith random number. the service returns the number y along with the merkle proof p. the service refuses to return this number unless the request for i has been submitted to the blockchain.
//user submits a transaction with (y, p, x, i). the pyth contract verifies that the proof p is valid for y,i and that hash(x) == h. the random number is then hash(y,x) (or you can xor them or whatever).

// TODOs:
// - Add a warning for integrators: you must incentivize the user to reveal their draw. They know the number and can choose to reveal or not.
// - bound fees to prevent overflows
// - governance??
contract PythRandom is PythRandomState {

    // TODO: Move to upgradeable proxy
    function initialize(uint pythFeeInWei) public {
        _state.accruedPythFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
    }

    function register(uint feeInWei, bytes20 initialCommitment, uint64 commitmentEnd) public {
        PythRandomStructs.ProviderInfo storage provider = _state.providers[msg.sender];

        if (_state.providers[msg.sender].currentCommitment != bytes20(0)) revert PythRandomErrors.AlreadyRegistered();
        provider.feeInWei = feeInWei;
        provider.accruedFeesInWei = 0;
        provider.sequenceNumber = 0;
        provider.currentCommitment = initialCommitment;
        provider.finalSequenceNumber = commitmentEnd;
        provider.nextCommitment = bytes20(0);
        provider.nextFinalSequenceNumber = 0;
    }

    // FIXME
    function rotate(bytes20 commitment, uint64 commitmentEnd) public {
        // TODO: check nonzero ?
        PythRandomStructs.ProviderInfo storage provider = _state.providers[msg.sender];
        provider.currentCommitment = commitment;
        provider.finalSequenceNumber = commitmentEnd;
    }

    function requestRandomNumber(address provider, bytes32 userCommitment) public payable returns (uint64 assignedSequenceNumber) {
        PythRandomStructs.ProviderInfo storage providerInfo = _state.providers[provider];

        // Assign a sequence number to the request
        assignedSequenceNumber = providerInfo.sequenceNumber;
        if (assignedSequenceNumber >= providerInfo.finalSequenceNumber) revert PythRandomErrors.OutOfRandomness();
        // TODO: Pretty sure this mutates the stored thing, but I don't know how solidity works
        providerInfo.sequenceNumber += 1;

        // Check that fees were paid and increment the pyth / provider balances.
        uint requiredFee = getFee(provider);
        if (msg.value < requiredFee) revert PythRandomErrors.InsufficientFee();
        providerInfo.accruedFeesInWei += providerInfo.feeInWei;
        _state.accruedPythFeesInWei += (msg.value - providerInfo.feeInWei);

        // Store the user's commitment so that we can fulfill the request later.
        PythRandomStructs.Request storage request = _state.requests[requestKey(provider, assignedSequenceNumber)];
        request.provider = provider;
        request.commitment = userCommitment;
        request.sequenceNumber = assignedSequenceNumber;
    }

    function fulfillRequest(address provider, uint64 sequenceNumber, uint256 userRandomness, bytes calldata proof) public returns (uint256 randomNumber) {
        // TODO: do i need to check that these are nonzero?
        PythRandomStructs.Request storage request = _state.requests[requestKey(provider, sequenceNumber)];
        PythRandomStructs.ProviderInfo storage providerInfo = _state.providers[provider];

        // TODO: need to handle rotation
        (bool valid, uint256 providerRevelation) = isProofValid(providerInfo.currentCommitment, sequenceNumber, proof);
        if (!valid) revert PythRandomErrors.IncorrectProviderRevelation();
        if (constructUserCommitment(userRandomness) != request.commitment) revert PythRandomErrors.IncorrectUserRevelation();

        randomNumber = combineRandomValues(userRandomness, providerRevelation);
    }

    function getFee(
        address provider
    ) public view returns (uint feeAmount) {
        // TODO: note why this can't overflow
        return _state.providers[provider].feeInWei + _state.pythFeeInWei;
    }

    function constructUserCommitment(uint256 userRandomness) public pure returns (bytes32 userCommitment) {
       userCommitment = keccak256(abi.encodePacked(userRandomness));
    }

    function combineRandomValues(uint256 userRandomness, uint256 providerRandomness) public pure returns (uint256 combinedRandomness) {
       combinedRandomness = uint256(keccak256(abi.encodePacked(userRandomness, providerRandomness)));
    }

    function requestKey(address provider, uint64 sequenceNumber) internal returns (bytes32 hash) {
        // Create a unique key for the mapping based on the tuple
        hash = keccak256(abi.encodePacked(provider, sequenceNumber));
    }

    function isProofValid(bytes20 root, uint64 sequenceNumber, bytes calldata proof) internal returns (bool valid, uint256 providerRevelation) {
        // 8 + 32 = sequenceNumber (uint64) + random value (uint256)
        uint16 leafSize = 40;
        bytes calldata leafData = UnsafeCalldataBytesLib.slice(proof, 0, leafSize);
        uint64 providerSequenceNumber = UnsafeCalldataBytesLib.toUint64(leafData, 0);
        bool sequenceNumberValid = providerSequenceNumber == sequenceNumber;

        providerRevelation = UnsafeCalldataBytesLib.toUint256(leafData, 8);
        (bool proofValid, ) = MerkleTree.isProofValid(proof, leafSize, root, leafData);

        valid = proofValid && sequenceNumberValid;
    }
}

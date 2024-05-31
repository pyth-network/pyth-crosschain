// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

// Dummy contract for testing Fortuna service under heavy load
// This contract will request many random numbers from the Entropy contract in a single transaction
// It also reverts on some of the callbacks for testing the retry mechanism
contract EntropyTester is IEntropyConsumer {
    IEntropy entropy;
    mapping(uint64 => bool) public shouldRevert;

    constructor(address entropyAddress) {
        entropy = IEntropy(entropyAddress);
    }

    function batchRequests(
        address provider,
        uint64 successCount,
        uint64 revertCount
    ) public payable {
        uint128 fee = entropy.getFee(provider);
        bytes32 zero;
        for (uint64 i = 0; i < successCount; i++) {
            uint64 seqNum = entropy.requestWithCallback{value: fee}(
                provider,
                zero
            );
            shouldRevert[seqNum] = false;
        }
        for (uint64 i = 0; i < revertCount; i++) {
            uint64 seqNum = entropy.requestWithCallback{value: fee}(
                provider,
                zero
            );
            shouldRevert[seqNum] = true;
        }
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function entropyCallback(
        uint64 sequence,
        address, //provider
        bytes32 //randomNumber
    ) internal view override {
        if (shouldRevert[sequence]) {
            revert("Reverting");
        }
    }
}

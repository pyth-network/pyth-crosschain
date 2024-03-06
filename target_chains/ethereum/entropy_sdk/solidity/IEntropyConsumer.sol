// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

interface IEntropyConsumer {
    // This method is called by Entropy to provide the random number to the consumer.
    function entropyCallback(uint64 sequence, bytes32 randomness) external;
}

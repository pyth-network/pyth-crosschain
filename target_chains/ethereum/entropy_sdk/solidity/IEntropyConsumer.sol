// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

abstract contract IEntropyConsumer {
    address public entropy;

    // This method is called by Entropy to provide the random number to the consumer.
    function _entropyCallback(uint64 sequence, bytes32 randomNumber) external {
        require(entropy != address(0), "Entropy address not set");
        require(msg.sender == entropy, "Only Entropy can call this function");

        entropyCallback(sequence, randomNumber);
    }

    // This method is expected to be implemented by the consumer to handle the random number.
    function entropyCallback(
        uint64 sequence,
        bytes32 randomNumber
    ) internal virtual;
}

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

abstract contract IEntropyConsumer {
    // This address should be set to point at the Entropy contract. If not set, the
    // contract will revert when it receives a callback from Entropy.
    // Entropy address can be found here - https://docs.pyth.network/entropy/contract-addresses
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

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

abstract contract IEntropyConsumer {
    // This address should be set to point at the Entropy contract. If not set, the
    // contract will revert when it receives a callback from Entropy.
    // Entropy address can be found here - https://docs.pyth.network/entropy/contract-addresses

    // This method is called by Entropy to provide the random number to the consumer.
    // It asserts that the msg.sender is the Entropy contract. It is not meant to be
    // override by the consumer.
    function _entropyCallback(uint64 sequence, bytes32 randomNumber) external {
        address entropy = getEntropy();
        require(entropy != address(0), "Entropy address not set");
        require(msg.sender == entropy, "Only Entropy can call this function");

        entropyCallback(sequence, randomNumber);
    }

    // getEntropy returns Entropy contract address. It is being used to check that the callback
    // is indeed from Entropy contract. The consumer is expected to implement this method.
    function getEntropy() internal view virtual returns (address);

    // This method is expected to be implemented by the consumer to handle the random number.
    // It will be called by _entropyCallback after _entropyCallback ensures that the call is
    // indeed from Entropy contract.
    function entropyCallback(
        uint64 sequence,
        bytes32 randomNumber
    ) internal virtual;
}

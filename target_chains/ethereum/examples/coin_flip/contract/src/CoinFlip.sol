// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

// Import the entropy SDK in order to interact with the entropy contracts
import "entropy-sdk-solidity/IEntropy.sol";
import "entropy-sdk-solidity/IEntropyConsumer.sol";

library CoinFlipErrors {
    error IncorrectSender();

    error InsufficientFee();
}

/// Example contract using Pyth Entropy to allow a user to flip a secure fair coin.
/// Users interact with the contract by requesting a random number from the entropy provider.
/// The entropy provider will then fulfill the request by revealing their random number.
/// Once the provider has fulfilled their request the entropy contract will call back
/// the requesting contract with the generated random number.
///
/// The CoinFlip contract implements the IEntropyConsumer interface imported from the Solidity SDK.
/// The interface helps in integrating with Entropy correctly.
contract CoinFlip is IEntropyConsumer {
    // Event emitted when a coin flip is requested. The sequence number can be used to identify a request
    event FlipRequest(uint64 sequenceNumber);

    // Event emitted when the result of the coin flip is known.
    event FlipResult(uint64 sequenceNumber, bool isHeads);

    // Contracts using Pyth Entropy should import the solidity SDK and then store both the Entropy contract
    // and a specific entropy provider to use for requests. Each provider commits to a sequence of random numbers.
    // Providers are then responsible for fulfilling a request on chain by revealing their random number.
    // Users should choose a reliable provider who they trust to uphold these commitments.
    // (For the moment, the only available provider is 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344)
    IEntropy private entropy;
    address private entropyProvider;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    // Request to flip a coin. The caller should generate and pass in a random number when calling this method.
    function requestFlip(bytes32 userRandomNumber) external payable {
        // The entropy protocol requires the caller to pay a fee (in native gas tokens) per requested random number.
        // This fee can either be paid by the contract itself or passed on to the end user.
        // This implementation of the requestFlip method passes on the fee to the end user.
        uint256 fee = entropy.getFee(entropyProvider);
        if (msg.value < fee) {
            revert CoinFlipErrors.InsufficientFee();
        }

        // Request the random number from the Entropy protocol. The call returns a sequence number that uniquely
        // identifies the generated random number. Callers can use this sequence number to match which request
        // is being revealed in the next stage of the protocol.
        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            entropyProvider,
            userRandomNumber
        );

        emit FlipRequest(sequenceNumber);
    }

    // Get the fee to flip a coin. See the comment above about fees.
    function getFlipFee() public view returns (uint256 fee) {
        fee = entropy.getFee(entropyProvider);
    }

    // This method is required by the IEntropyConsumer interface.
    // It is called by the entropy contract when a random number is generated.
    function entropyCallback(
        uint64 sequenceNumber,
        // If your app uses multiple providers, you can use this argument
        // to distinguish which one is calling the app back. This app only
        // uses one provider so this argument is not used.
        address,
        bytes32 randomNumber
    ) internal override {
        emit FlipResult(sequenceNumber, uint256(randomNumber) % 2 == 0);
    }

    // This method is required by the IEntropyConsumer interface.
    // It returns the address of the entropy contract which will call the callback.
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    receive() external payable {}
}

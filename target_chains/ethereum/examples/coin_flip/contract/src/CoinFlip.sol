// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "entropy-sdk-solidity/IEntropy.sol";

library CoinFlipErrors {
    error IncorrectSender();

    error InsufficientFee();
}

contract CoinFlip {
    event FlipResult(bool isHeads);

    IEntropy private entropy;
    address private entropyProvider;
    mapping(uint64 => address) private requestedFlips;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    function requestFlip(bytes32 userCommitment) external payable {
        uint256 fee = entropy.getFee(entropyProvider);
        if (msg.value < fee) {
            revert CoinFlipErrors.InsufficientFee();
        }

        uint64 sequenceNumber = entropy.request{value: fee}(
            entropyProvider,
            userCommitment,
            true
        );
        requestedFlips[sequenceNumber] = msg.sender;
    }

    function revealFlip(
        uint64 sequenceNumber,
        bytes32 userRandom,
        bytes32 providerRandom
    ) public {
        if (requestedFlips[sequenceNumber] != msg.sender) {
            revert CoinFlipErrors.IncorrectSender();
        }

        bytes32 randomNumber = entropy.reveal(
            entropyProvider,
            sequenceNumber,
            userRandom,
            providerRandom
        );
        emit FlipResult(uint256(randomNumber) % 2 == 0);
    }

    // Reinitialize the parameters of this contract.
    // (This function is for demo purposes only. You wouldn't include this on a real contract.)
    function reinitialize(address _entropy, address _entropyProvider) public {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    receive() external payable {}
}

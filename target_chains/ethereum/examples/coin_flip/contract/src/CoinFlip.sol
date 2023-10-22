// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "entropy-sdk-solidity/IEntropy.sol";

// import "entropy-sdk-solidity/EntropyStructs.sol";
// import "../../../../entropy_sdk/solidity/IEntropy.sol";

library CoinFlipErrors {
    // An invariant of the contract failed to hold. This error indicates a software logic bug.
    error IncorrectSender();

    error InsufficientFee();
}

contract CoinFlip {
    event FlipResult(bool isHeads);

    IEntropy private entropy;
    address entropyProvider;
    mapping(uint64 => address) private requestedFlips;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    function requestFlip(bytes32 userCommitment) external payable {
        uint256 fee = entropy.getFee(provider);
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
        emit FlipResult(randomNumber % 2 == 0);
    }

    // Reinitialize the parameters of this contract.
    // (This function is for demo purposes only. You wouldn't include this on a real contract.)
    function reinitialize(
        bytes32 _baseTokenPriceId,
        bytes32 _quoteTokenPriceId,
        address _baseToken,
        address _quoteToken
    ) external {
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    receive() external payable {}
}

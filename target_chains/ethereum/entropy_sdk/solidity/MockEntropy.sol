// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {IEntropyConsumer} from "./IEntropyConsumer.sol";
import "./EntropyErrors.sol";

contract MockEntropy {
    uint256 public fee;

    mapping(uint256 => address) public callbackRequests;
    uint64 public currentSequenceNumber;

    constructor(uint256 _fee) {
        fee = _fee;
    }

    function getDefaultProvider() external view returns (address) {
        return address(this);
    }

    function getFee(
        address provider
    ) external view isProvider(provider) returns (uint256) {
        return fee;
    }

    function setFee(uint256 _fee) external {
        fee = _fee;
    }

    function requestWithCallback(
        address provider,
        bytes32 userRandomNumber
    ) external payable isProvider(provider) returns (uint64) {
        if (msg.value < fee) {
            revert EntropyErrors.InsufficientFee();
        }
        callbackRequests[currentSequenceNumber] = msg.sender;
        return currentSequenceNumber++;
    }

    function triggerCallback(
        uint256 randomNumber,
        uint64 sequenceNumber
    ) external {
        address callbackAddress = callbackRequests[sequenceNumber];
        if (callbackAddress == address(0)) {
            revert EntropyErrors.NoSuchRequest();
        }
        bytes32 randomNumberBytes = bytes32(randomNumber);
        IEntropyConsumer(callbackAddress)._entropyCallback(
            sequenceNumber,
            address(this),
            randomNumberBytes
        );
        callbackRequests[sequenceNumber] = address(0);
    }

    modifier isProvider(address provider) {
        if (provider != address(this)) {
            revert EntropyErrors.NoSuchProvider();
        }
        _;
    }
}

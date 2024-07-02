// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {IEntropyConsumer} from "./IEntropyConsumer.sol";

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
        address _provider
    ) external view isProvider(_provider) returns (uint256) {
        return fee;
    }

    function setFee(uint256 _fee) external {
        fee = _fee;
    }

    function requestWithCallback(
        address _provider,
        bytes32 _userRandomNumber
    ) external payable isProvider(_provider) returns (uint64) {
        require(msg.value >= fee, "Not enough ether sent for fee");
        callbackRequests[currentSequenceNumber] = msg.sender;
        return currentSequenceNumber++;
    }

    function triggerCallback(
        uint256 _randomNumber,
        uint64 _sequenceNumber
    ) external {
        address callbackAddress = callbackRequests[_sequenceNumber];
        require(callbackAddress != address(0), "No pending request");
        bytes32 randomNumberBytes = bytes32(_randomNumber);
        IEntropyConsumer(callbackAddress)._entropyCallback(
            _sequenceNumber,
            callbackAddress,
            randomNumberBytes
        );
        callbackRequests[_sequenceNumber] = address(0);
    }

    modifier isProvider(address _provider) {
        require(_provider == address(this), "Invalid provider address");
        _;
    }
}

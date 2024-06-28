// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

interface IEntropyConsumer {
    function _entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;
}

contract MockEntropy {
    uint64 public sequenceNumber;
    uint128 public constant FEE = 0.000015 ether;

    function getDefaultProvider() external view returns (address) {
        return address(this);
    }

    function getFee(address provider) external pure returns (uint128) {
        require(provider != address(0), "Invalid provider address");
        return FEE;
    }

    function requestWithCallback(
        address provider,
        bytes32 userRandomNumber
    ) external payable returns (uint64) {
        require(provider != address(0), "Invalid provider address");
        require(msg.value >= FEE, "Not enough ether sent for fee");
        return sequenceNumber++;
    }

    function triggerCallback(
        uint64 _sequenceNumber,
        uint256 _randomNumber,
        address _callbackAddress
    ) external {
        bytes32 randomNumberBytes = bytes32(_randomNumber);
        IEntropyConsumer(_callbackAddress)._entropyCallback(
            _sequenceNumber,
            _callbackAddress,
            randomNumberBytes
        );
    }
}

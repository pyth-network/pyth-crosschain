// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";

abstract contract EntropyTestUtils is Test {
    // Generate a hash chain for a provider that can be used for test purposes.
    function generateHashChain(
        address provider,
        uint64 startSequenceNumber,
        uint64 size
    ) public pure returns (bytes32[] memory hashChain) {
        bytes32 initialValue = keccak256(
            abi.encodePacked(provider, startSequenceNumber)
        );
        hashChain = new bytes32[](size);
        for (uint64 i = 0; i < size; i++) {
            hashChain[size - (i + 1)] = initialValue;
            initialValue = keccak256(bytes.concat(initialValue));
        }
    }
}

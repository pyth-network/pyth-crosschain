// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

interface EntropyEvents {
    event Registered(EntropyStructs.ProviderInfo provider);

    event Requested(EntropyStructs.Request request);
    event RequestedWithCallback(
        address indexed provider,
        address indexed requestor,
        uint64 indexed sequenceNumber,
        bytes32 userRandomNumber,
        EntropyStructs.Request request
    );

    event Revealed(
        EntropyStructs.Request request,
        bytes32 userRevelation,
        bytes32 providerRevelation,
        bytes32 blockHash,
        bytes32 randomNumber
    );
    event RevealedWithCallback(
        EntropyStructs.Request request,
        bytes32 userRandomNumber,
        bytes32 providerRevelation,
        bytes32 randomNumber
    );

    event ProviderFeeUpdated(address provider, uint128 oldFee, uint128 newFee);

    event ProviderUriUpdated(address provider, bytes oldUri, bytes newUri);
}

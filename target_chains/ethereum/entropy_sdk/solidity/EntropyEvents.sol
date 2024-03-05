// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

interface EntropyEvents {
    event Registered(EntropyStructs.ProviderInfo provider);

    event Requested(EntropyStructs.Request request);
    event RequestedWithCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    );

    event Revealed(
        EntropyStructs.Request request,
        bytes32 userRevelation,
        bytes32 providerRevelation,
        bytes32 blockHash,
        bytes32 randomNumber
    );

    event RevealedAndCalledBack(
        EntropyStructs.Request request,
        bytes32 userRevelation,
        bytes32 providerRevelation,
        bytes32 blockHash,
        bytes32 randomNumber,
        address callAddress
    );

    event ProviderFeeUpdated(address provider, uint128 oldFee, uint128 newFee);

    event ProviderUriUpdated(address provider, bytes oldUri, bytes newUri);
}

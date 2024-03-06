// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

// TODO: correct order of event props
interface EntropyEvents {
    event Registered(EntropyStructs.ProviderInfo provider);

    event Requested(EntropyStructs.Request request);
    event RequestedWithCallback(
        address provider,
        uint64 sequenceNumber,
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
        bytes32 protocolRandomNumber,
        bytes32 providerRevelation,
        bytes32 randomNumber,
        uint64 sequenceNumber,
        address provider,
        address callAddress
    );

    event ProviderFeeUpdated(address provider, uint128 oldFee, uint128 newFee);

    event ProviderUriUpdated(address provider, bytes oldUri, bytes newUri);
}

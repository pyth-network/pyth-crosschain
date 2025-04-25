// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

interface EntropyEventsV2 {
    event Registered(address indexed provider, bytes dummy);

    event Requested(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 userRandomNumber,
        bytes dummy
    );

    event Revealed(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 randomNumber,
        bool callbackFailed,
        bytes callbackErrorCode,
        bytes dummy
    );

    event ProviderFeeUpdated(address indexed provider, uint128 oldFee, uint128 newFee, bytes dummy);

    event ProviderDefaultGasLimitUpdated(
        address indexed provider,
        uint32 oldDefaultGasLimit,
        uint32 newDefaultGasLimit,
        bytes dummy
    );

    event ProviderUriUpdated(address indexed provider, bytes oldUri, bytes newUri, bytes dummy);

    event ProviderFeeManagerUpdated(
        address indexed provider,
        address oldFeeManager,
        address newFeeManager,
        bytes dummy
    );
    event ProviderMaxNumHashesAdvanced(
        address indexed provider,
        uint32 oldMaxNumHashes,
        uint32 newMaxNumHashes,
        bytes dummy
    );

    event Withdrawal(
        address indexed provider,
        address indexed recipient,
        uint128 withdrawnAmount,
        bytes dummy
    );
}

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PulseState.sol";

interface PulseEvents {
    // Events
    event ProviderRegistered(PulseState.ProviderInfo providerInfo);

    event PriceUpdateRequested(PulseState.Request request);

    event PriceUpdateExecuted(
        uint64 indexed sequenceNumber,
        address indexed provider,
        uint256 publishTime,
        bytes32[] priceIds,
        int64[] prices,
        uint64[] conf,
        int32[] expos,
        uint256[] publishTimes
    );

    event ProviderFeeUpdated(
        address indexed provider,
        uint128 oldFeeInWei,
        uint128 newFeeInWei
    );

    event ProviderUriUpdated(
        address indexed provider,
        bytes oldUri,
        bytes newUri
    );

    event ProviderWithdrawn(
        address indexed provider,
        address indexed recipient,
        uint128 amount
    );

    event ProviderFeeManagerUpdated(
        address indexed provider,
        address oldFeeManager,
        address newFeeManager
    );

    event ProviderMaxNumPricesUpdated(
        address indexed provider,
        uint32 oldMaxNumPrices,
        uint32 maxNumPrices
    );

    event PriceUpdateCallbackFailed(
        uint64 indexed sequenceNumber,
        address indexed provider,
        uint256 publishTime,
        bytes32[] priceIds,
        address requester,
        string reason
    );
}

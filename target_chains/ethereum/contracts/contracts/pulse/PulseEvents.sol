// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PulseState.sol";

interface PulseEvents {
    event PriceUpdateRequested(PulseState.Request request, bytes32[] priceIds);

    event PriceUpdateExecuted(
        uint64 indexed sequenceNumber,
        address indexed provider,
        bytes32[] priceIds,
        int64[] prices,
        uint64[] conf,
        int32[] expos,
        uint256[] publishTimes
    );

    event FeesWithdrawn(address indexed recipient, uint128 amount);

    event PriceUpdateCallbackFailed(
        uint64 indexed sequenceNumber,
        address indexed provider,
        bytes32[] priceIds,
        address requester,
        string reason
    );

    event FeeManagerUpdated(
        address indexed admin,
        address oldFeeManager,
        address newFeeManager
    );

    event ProviderRegistered(address indexed provider, uint128 feeInWei);
    event ProviderFeeUpdated(
        address indexed provider,
        uint128 oldFee,
        uint128 newFee
    );
    event DefaultProviderUpdated(address oldProvider, address newProvider);

    event ExclusivityPeriodUpdated(
        uint256 oldPeriodSeconds,
        uint256 newPeriodSeconds
    );
}

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PulseState.sol";

interface PulseEvents {
    event PriceUpdateRequested(PulseState.Request request);

    event PriceUpdateExecuted(
        uint64 indexed sequenceNumber,
        address indexed updater,
        uint256 publishTime,
        bytes32[] priceIds,
        int64[] prices,
        uint64[] conf,
        int32[] expos,
        uint256[] publishTimes
    );

    event FeesWithdrawn(address indexed recipient, uint128 amount);

    event PriceUpdateCallbackFailed(
        uint64 indexed sequenceNumber,
        address indexed updater,
        uint256 publishTime,
        bytes32[] priceIds,
        address requester,
        string reason
    );

    event FeeManagerUpdated(
        address indexed admin,
        address oldFeeManager,
        address newFeeManager
    );
}

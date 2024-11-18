// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PulseEvents.sol";
import "./PulseState.sol";

interface IPulseConsumer {
    function pulseCallback(
        uint64 sequenceNumber,
        address updater,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external;
}

interface IPulse is PulseEvents {
    // Core functions
    function requestPriceUpdatesWithCallback(
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    function executeCallback(
        uint64 sequenceNumber,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    ) external payable;

    // Getters
    function getFee(
        uint256 callbackGasLimit
    ) external view returns (uint128 feeAmount);

    function getPythFeeInWei() external view returns (uint128 pythFeeInWei);

    function getAccruedFees() external view returns (uint128 accruedFeesInWei);

    function getRequest(
        uint64 sequenceNumber
    ) external view returns (PulseState.Request memory req);

    // Add these functions to the IPulse interface
    function setFeeManager(address manager) external;

    function withdrawAsFeeManager(uint128 amount) external;
}

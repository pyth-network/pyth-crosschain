// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PulseEvents.sol";
import "./PulseState.sol";

interface IPulseConsumer {
    function pulseCallback(
        uint64 sequenceNumber,
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external;
}

interface IPulse is PulseEvents {
    // Core functions
    function requestPriceUpdatesWithCallback(
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    function executeCallback(
        address provider,
        uint64 sequenceNumber,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    ) external payable;

    // Provider management
    function register(
        uint128 feeInWei,
        uint128 feePerGas,
        bytes calldata uri
    ) external;

    function setProviderFee(uint128 newFeeInWei) external;

    function setProviderFeeAsFeeManager(
        address provider,
        uint128 newFeeInWei
    ) external;

    function setProviderUri(bytes calldata uri) external;

    function withdraw(uint128 amount) external;

    function withdrawAsFeeManager(address provider, uint128 amount) external;

    // Getters
    function getFee(
        address provider,
        uint256 callbackGasLimit
    ) external view returns (uint128 feeAmount);

    function getPythFeeInWei() external view returns (uint128 pythFeeInWei);

    function getAccruedPythFees()
        external
        view
        returns (uint128 accruedPythFeesInWei);

    function getDefaultProvider() external view returns (address);

    function getProviderInfo(
        address provider
    ) external view returns (PulseState.ProviderInfo memory info);

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) external view returns (PulseState.Request memory req);

    // Setters
    function setFeeManager(address manager) external;

    function setMaxNumPrices(uint32 maxNumPrices) external;
}

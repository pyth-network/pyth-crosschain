// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PulseState.sol";

interface IPulseConsumer {
    function pulseCallback(
        uint64 sequenceNumber,
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external;
}

interface IPulse {
    // Events
    event ProviderRegistered(PulseState.ProviderInfo providerInfo);

    event PriceUpdateRequested(PulseState.Request request);

    event PriceUpdateExecuted(
        uint64 indexed sequenceNumber,
        address indexed provider,
        uint256 publishTime,
        bytes32[] priceIds
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

    // Core functions
    function requestPriceUpdatesWithCallback(
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    function executeCallback(
        uint64 sequenceNumber,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    ) external;

    // Provider management
    function register(uint128 feeInWei, bytes calldata uri) external;

    function setProviderFee(uint128 newFeeInWei) external;

    function setProviderFeeAsFeeManager(
        address provider,
        uint128 newFeeInWei
    ) external;

    function setProviderUri(bytes calldata uri) external;

    function withdraw(uint128 amount) external;

    function withdrawAsFeeManager(address provider, uint128 amount) external;

    // Getters
    function getFee(address provider) external view returns (uint128 feeAmount);

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

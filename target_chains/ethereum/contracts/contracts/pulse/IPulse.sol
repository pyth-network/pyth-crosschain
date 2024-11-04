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
    event PriceUpdateRequested(
        uint64 indexed sequenceNumber,
        address indexed provider,
        uint256 publishTime,
        bytes32[] priceIds,
        address requester
    );

    event PriceUpdateExecuted(
        uint64 indexed sequenceNumber,
        address indexed provider,
        uint256 publishTime,
        bytes32[] priceIds
    );

    event ProviderRegistered(
        address indexed provider,
        uint128 feeInWei,
        bytes uri
    );

    event ProviderFeeUpdated(
        address indexed provider,
        uint128 oldFeeInWei,
        uint128 newFeeInWei
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

    event ProviderUriUpdated(
        address indexed provider,
        bytes oldUri,
        bytes newUri
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
        bytes[] calldata updateData,
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

    function withdraw(uint128 amount) external;

    function withdrawAsFeeManager(address provider, uint128 amount) external;

    function setProviderUri(bytes calldata uri) external;

    // Getters
    function getFee(address provider) external view returns (uint128 feeAmount);

    function getDefaultProvider() external view returns (address);

    function getAccruedPythFees()
        external
        view
        returns (uint128 accruedPythFeesInWei);

    function getProviderInfo(
        address provider
    ) external view returns (PulseState.ProviderInfo memory info);

    function getAdmin() external view returns (address admin);

    function getPythFeeInWei() external view returns (uint128 pythFeeInWei);

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) external view returns (PulseState.Request memory req);

    // Setters
    function setFeeManager(address manager) external;

    function setProviderFeeAsFeeManager(
        address provider,
        uint128 newFeeInWei
    ) external;

    function setMaxNumPrices(uint32 maxNumPrices) external;
}

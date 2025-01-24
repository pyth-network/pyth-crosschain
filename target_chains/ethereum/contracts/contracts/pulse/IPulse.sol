// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "./PulseEvents.sol";
import "./PulseState.sol";

interface IPulseConsumer {
    function pulseCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) external;
}

interface IPulse is PulseEvents {
    // Core functions
    /**
     * @notice Requests price updates with a callback
     * @dev The msg.value must be equal to getFee(callbackGasLimit)
     * @param callbackGasLimit The amount of gas allocated for the callback execution
     * @param publishTime The minimum publish time for price updates, it should be less than or equal to block.timestamp + 60
     * @param priceIds The price feed IDs to update. Maximum 10 price feeds per request.
     *        Requests requiring more feeds should be split into multiple calls.
     * @return sequenceNumber The sequence number assigned to this request
     * @dev Security note: The 60-second future limit on publishTime prevents a DoS vector where
     *      attackers could submit many low-fee requests for far-future updates when gas prices
     *      are low, forcing executors to fulfill them later when gas prices might be much higher.
     *      Since tx.gasprice is used to calculate fees, allowing far-future requests would make
     *      the fee estimation unreliable.
     */
    function requestPriceUpdatesWithCallback(
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    /**
     * @notice Executes the callback for a price update request
     * @dev Requires 1.5x the callback gas limit to account for cross-contract call overhead
     * For example, if callbackGasLimit is 1M, the transaction needs at least 1.5M gas + some gas for some other operations in the function before the callback
     * @param sequenceNumber The sequence number of the request
     * @param updateData The raw price update data from Pyth
     * @param priceIds The price feed IDs to update, must match the request
     */
    function executeCallback(
        uint64 sequenceNumber,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external payable;

    // Getters
    /**
     * @notice Gets the base fee charged by Pyth protocol
     * @dev This is a fixed fee per request that goes to the Pyth protocol, separate from gas costs
     * @return pythFeeInWei The base fee in wei that every request must pay
     */
    function getPythFeeInWei() external view returns (uint128 pythFeeInWei);

    /**
     * @notice Calculates the total fee required for a price update request
     * @dev Total fee = base Pyth protocol fee + gas costs for callback
     * @param callbackGasLimit The amount of gas allocated for callback execution
     * @return feeAmount The total fee in wei that must be provided as msg.value
     */
    function getFee(
        uint256 callbackGasLimit
    ) external view returns (uint128 feeAmount);

    function getAccruedFees() external view returns (uint128 accruedFeesInWei);

    function getRequest(
        uint64 sequenceNumber
    ) external view returns (PulseState.Request memory req);

    function setFeeManager(address manager) external;

    function withdrawAsFeeManager(address provider, uint128 amount) external;

    function registerProvider(uint128 feeInWei) external;

    function setProviderFee(uint128 newFeeInWei) external;

    function getProviderInfo(
        address provider
    ) external view returns (PulseState.ProviderInfo memory);

    function getDefaultProvider() external view returns (address);

    function setDefaultProvider(address provider) external;

    function setExclusivityPeriod(uint256 periodSeconds) external;

    function getExclusivityPeriod() external view returns (uint256);
}

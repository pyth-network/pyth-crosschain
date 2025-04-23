// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "./EchoEvents.sol";
import "./EchoState.sol";

abstract contract IEchoConsumer {
    // This method is called by Echo to provide the price updates to the consumer.
    // It asserts that the msg.sender is the Echo contract. It is not meant to be
    // overridden by the consumer.
    function _echoCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) external {
        address echo = getEcho();
        require(echo != address(0), "Echo address not set");
        require(msg.sender == echo, "Only Echo can call this function");

        echoCallback(sequenceNumber, priceFeeds);
    }

    // getEcho returns the Echo contract address. The method is being used to check that the
    // callback is indeed from the Echo contract. The consumer is expected to implement this method.
    function getEcho() internal view virtual returns (address);

    // This method is expected to be implemented by the consumer to handle the price updates.
    // It will be called by _echoCallback after _echoCallback ensures that the call is
    // indeed from Echo contract.
    function echoCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal virtual;
}

interface IEcho is EchoEvents {
    // Core functions
    /**
     * @notice Requests price updates with a callback
     * @dev The msg.value must be equal to getFee(callbackGasLimit)
     * @param provider The provider to fulfill the request
     * @param publishTime The minimum publish time for price updates, it should be less than or equal to block.timestamp + 60
     * @param priceIds The price feed IDs to update. Maximum 10 price feeds per request.
     *        Requests requiring more feeds should be split into multiple calls.
     * @param callbackGasLimit The amount of gas allocated for the callback execution
     * @return sequenceNumber The sequence number assigned to this request
     * @dev Security note: The 60-second future limit on publishTime prevents a DoS vector where
     *      attackers could submit many low-fee requests for far-future updates when gas prices
     *      are low, forcing executors to fulfill them later when gas prices might be much higher.
     *      Since tx.gasprice is used to calculate fees, allowing far-future requests would make
     *      the fee estimation unreliable.
     */
    function requestPriceUpdatesWithCallback(
        address provider,
        uint64 publishTime,
        bytes32[] calldata priceIds,
        uint32 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    /**
     * @notice Executes the callback for a price update request
     * @dev Requires 1.5x the callback gas limit to account for cross-contract call overhead
     * For example, if callbackGasLimit is 1M, the transaction needs at least 1.5M gas + some gas for some other operations in the function before the callback
     * @param providerToCredit The provider to credit for fulfilling the request. This may not be the provider that submitted the request (if the exclusivity period has elapsed).
     * @param sequenceNumber The sequence number of the request
     * @param updateData The raw price update data from Pyth
     * @param priceIds The price feed IDs to update, must match the request
     */
    function executeCallback(
        address providerToCredit,
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
    function getPythFeeInWei() external view returns (uint96 pythFeeInWei);

    /**
     * @notice Calculates the total fee required for a price update request
     * @dev Total fee = base Pyth protocol fee + base provider fee + provider fee per feed + gas costs for callback
     * @param provider The provider to fulfill the request
     * @param callbackGasLimit The amount of gas allocated for callback execution
     * @param priceIds The price feed IDs to update.
     * @return feeAmount The total fee in wei that must be provided as msg.value
     */
    function getFee(
        address provider,
        uint32 callbackGasLimit,
        bytes32[] calldata priceIds
    ) external view returns (uint96 feeAmount);

    function getAccruedPythFees()
        external
        view
        returns (uint128 accruedFeesInWei);

    function getRequest(
        uint64 sequenceNumber
    ) external view returns (EchoState.Request memory req);

    function setFeeManager(address manager) external;

    /**
     * @notice Allows the admin to withdraw accumulated Pyth protocol fees
     * @param amount The amount of fees to withdraw in wei
     */
    function withdrawFees(uint128 amount) external;

    function withdrawAsFeeManager(address provider, uint128 amount) external;

    function registerProvider(
        uint96 baseFeeInWei,
        uint96 feePerFeedInWei,
        uint96 feePerGasInWei
    ) external;

    function setProviderFee(
        address provider,
        uint96 newBaseFeeInWei,
        uint96 newFeePerFeedInWei,
        uint96 newFeePerGasInWei
    ) external;

    function getProviderInfo(
        address provider
    ) external view returns (EchoState.ProviderInfo memory);

    function getDefaultProvider() external view returns (address);

    function setDefaultProvider(address provider) external;

    function setExclusivityPeriod(uint32 periodSeconds) external;

    function getExclusivityPeriod() external view returns (uint32);

    /**
     * @notice Gets the first N active requests
     * @param count Maximum number of active requests to return
     * @return requests Array of active requests, ordered from oldest to newest
     * @return actualCount Number of active requests found (may be less than count)
     * @dev Gas Usage: This function's gas cost scales linearly with the number of requests
     *      between firstUnfulfilledSeq and currentSequenceNumber. Each iteration costs approximately:
     *      - 2100 gas for cold storage reads, 100 gas for warm storage reads (SLOAD)
     *      - Additional gas for array operations
     *      The function starts from firstUnfulfilledSeq (all requests before this are fulfilled)
     *      and scans forward until it finds enough active requests or reaches currentSequenceNumber.
     */
    function getFirstActiveRequests(
        uint256 count
    )
        external
        view
        returns (EchoState.Request[] memory requests, uint256 actualCount);
}

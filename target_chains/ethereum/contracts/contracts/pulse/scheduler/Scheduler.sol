// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "./IScheduler.sol";
import "./SchedulerState.sol";
import "./SchedulerErrors.sol";

abstract contract Scheduler is IScheduler, SchedulerState {
    function _initialize(address admin, address pythAddress) internal {
        require(admin != address(0), "admin is zero address");
        require(pythAddress != address(0), "pyth is zero address");

        _state.pyth = pythAddress;
        _state.subscriptionNumber = 1;
    }

    function createSubscription(
        SubscriptionParams memory subscriptionParams
    ) external payable override returns (uint256 subscriptionId) {
        if (
            subscriptionParams.priceIds.length > MAX_PRICE_IDS_PER_SUBSCRIPTION
        ) {
            revert TooManyPriceIds(
                subscriptionParams.priceIds.length,
                MAX_PRICE_IDS_PER_SUBSCRIPTION
            );
        }

        // Validate update criteria
        if (
            !subscriptionParams.updateCriteria.updateOnHeartbeat &&
            !subscriptionParams.updateCriteria.updateOnDeviation
        ) {
            revert InvalidUpdateCriteria();
        }

        // If gas config is unset, set it to the default (100x multipliers)
        if (
            subscriptionParams.gasConfig.maxBaseFeeMultiplierCapPct == 0 ||
            subscriptionParams.gasConfig.maxPriorityFeeMultiplierCapPct == 0
        ) {
            subscriptionParams
                .gasConfig
                .maxPriorityFeeMultiplierCapPct = DEFAULT_MAX_PRIORITY_FEE_MULTIPLIER_CAP_PCT;
            subscriptionParams
                .gasConfig
                .maxBaseFeeMultiplierCapPct = DEFAULT_MAX_BASE_FEE_MULTIPLIER_CAP_PCT;
        }

        // Calculate minimum balance required for this subscription
        uint256 minimumBalance = this.getMinimumBalance(
            uint8(subscriptionParams.priceIds.length)
        );

        // Ensure enough funds were provided
        if (msg.value < minimumBalance) {
            revert InsufficientBalance();
        }

        // Set subscription to active
        subscriptionParams.isActive = true;

        subscriptionId = _state.subscriptionNumber++;

        // Store the subscription parameters
        _state.subscriptionParams[subscriptionId] = subscriptionParams;

        // Initialize subscription status
        SubscriptionStatus storage status = _state.subscriptionStatuses[
            subscriptionId
        ];
        status.priceLastUpdatedAt = 0;
        status.balanceInWei = msg.value;
        status.totalUpdates = 0;
        status.totalSpent = 0;

        // Map subscription ID to manager
        _state.subscriptionManager[subscriptionId] = msg.sender;

        emit SubscriptionCreated(subscriptionId, msg.sender);
        return subscriptionId;
    }

    function updateSubscription(
        uint256 subscriptionId,
        SubscriptionParams memory newParams
    ) external override onlyManager(subscriptionId) {
        SchedulerState.SubscriptionStatus storage currentStatus = _state
            .subscriptionStatuses[subscriptionId];
        SchedulerState.SubscriptionParams storage currentParams = _state
            .subscriptionParams[subscriptionId];
        bool wasActive = currentParams.isActive;
        bool willBeActive = newParams.isActive;

        // If subscription is inactive and will remain inactive, no need to validate parameters
        if (!wasActive && !willBeActive) {
            // Update subscription parameters
            _state.subscriptionParams[subscriptionId] = newParams;
            emit SubscriptionUpdated(subscriptionId);
            return;
        }

        // Validate parameters for active or to-be-activated subscriptions
        if (newParams.priceIds.length > MAX_PRICE_IDS_PER_SUBSCRIPTION) {
            revert TooManyPriceIds(
                newParams.priceIds.length,
                MAX_PRICE_IDS_PER_SUBSCRIPTION
            );
        }

        // Validate update criteria
        if (
            !newParams.updateCriteria.updateOnHeartbeat &&
            !newParams.updateCriteria.updateOnDeviation
        ) {
            revert InvalidUpdateCriteria();
        }

        // If gas config is unset, set it to the default (100x multipliers)
        if (
            newParams.gasConfig.maxBaseFeeMultiplierCapPct == 0 ||
            newParams.gasConfig.maxPriorityFeeMultiplierCapPct == 0
        ) {
            newParams
                .gasConfig
                .maxPriorityFeeMultiplierCapPct = DEFAULT_MAX_PRIORITY_FEE_MULTIPLIER_CAP_PCT;
            newParams
                .gasConfig
                .maxBaseFeeMultiplierCapPct = DEFAULT_MAX_BASE_FEE_MULTIPLIER_CAP_PCT;
        }

        // Handle activation/deactivation
        if (!wasActive && willBeActive) {
            // Reactivating a subscription - ensure minimum balance
            uint256 minimumBalance = this.getMinimumBalance(
                uint8(newParams.priceIds.length)
            );

            // Check if balance meets minimum requirement
            if (currentStatus.balanceInWei < minimumBalance) {
                revert InsufficientBalance();
            }

            currentParams.isActive = true;
            emit SubscriptionActivated(subscriptionId);
        } else if (wasActive && !willBeActive) {
            // Deactivating a subscription
            currentParams.isActive = false;
            emit SubscriptionDeactivated(subscriptionId);
        }

        // Clear price updates for removed price IDs before updating params
        _clearRemovedPriceUpdates(
            subscriptionId,
            currentParams.priceIds,
            newParams.priceIds
        );

        // Update subscription parameters
        _state.subscriptionParams[subscriptionId] = newParams;

        emit SubscriptionUpdated(subscriptionId);
    }

    /**
     * @notice Internal helper to clear stored PriceFeed data for price IDs removed from a subscription.
     * @param subscriptionId The ID of the subscription being updated.
     * @param currentPriceIds The array of price IDs currently associated with the subscription.
     * @param newPriceIds The new array of price IDs for the subscription.
     */
    function _clearRemovedPriceUpdates(
        uint256 subscriptionId,
        bytes32[] storage currentPriceIds,
        bytes32[] memory newPriceIds
    ) internal {
        // Iterate through old price IDs
        for (uint i = 0; i < currentPriceIds.length; i++) {
            bytes32 oldPriceId = currentPriceIds[i];
            bool found = false;

            // Check if the old price ID exists in the new list
            for (uint j = 0; j < newPriceIds.length; j++) {
                if (newPriceIds[j] == oldPriceId) {
                    found = true;
                    break; // Found it, no need to check further
                }
            }

            // If not found in the new list, delete its stored update data
            if (!found) {
                delete _state.priceUpdates[subscriptionId][oldPriceId];
            }
        }
    }

    function updatePriceFeeds(
        uint256 subscriptionId,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external override {
        SubscriptionStatus storage status = _state.subscriptionStatuses[
            subscriptionId
        ];
        SubscriptionParams storage params = _state.subscriptionParams[
            subscriptionId
        ];

        if (!params.isActive) {
            revert InactiveSubscription();
        }

        // Verify price IDs match subscription
        if (priceIds.length != params.priceIds.length) {
            revert InvalidPriceIdsLength(priceIds[0], params.priceIds[0]);
        }

        // Keepers must provide priceIds in the exact same order as defined in the subscription
        for (uint8 i = 0; i < priceIds.length; i++) {
            if (priceIds[i] != params.priceIds[i]) {
                revert InvalidPriceId(priceIds[i], params.priceIds[i]);
            }
        }

        // Get the Pyth contract and parse price updates
        IPyth pyth = IPyth(_state.pyth);
        uint256 pythFee = pyth.getUpdateFee(updateData);

        // Check if subscription has enough balance
        if (status.balanceInWei < pythFee) {
            revert InsufficientBalance();
        }

        // Parse price feed updates with an expected timestamp range of [-10s, now]
        // We will validate the trigger conditions and timestamps ourselves
        // using the returned PriceFeeds.
        uint64 maxPublishTime = SafeCast.toUint64(block.timestamp);
        uint64 minPublishTime = maxPublishTime - 10 seconds;
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: pythFee
        }(updateData, priceIds, minPublishTime, maxPublishTime);

        // Verify all price feeds have the same timestamp
        uint256 timestamp = priceFeeds[0].price.publishTime;
        for (uint8 i = 1; i < priceFeeds.length; i++) {
            if (priceFeeds[i].price.publishTime != timestamp) {
                revert PriceTimestampMismatch();
            }
        }

        // Verify that update conditions are met, and that the timestamp
        // is more recent than latest stored update's. Reverts if not.
        _validateShouldUpdatePrices(subscriptionId, params, status, priceFeeds);

        // Store the price updates, update status, and emit event
        _storePriceUpdatesAndStatus(
            subscriptionId,
            status,
            priceFeeds,
            pythFee
        );
    }

    /**
     * @notice Stores the price updates, updates subscription status, and emits event.
     */
    function _storePriceUpdatesAndStatus(
        uint256 subscriptionId,
        SubscriptionStatus storage status,
        PythStructs.PriceFeed[] memory priceFeeds,
        uint256 pythFee
    ) internal {
        // Store the price updates
        for (uint8 i = 0; i < priceFeeds.length; i++) {
            _state.priceUpdates[subscriptionId][priceFeeds[i].id] = priceFeeds[
                i
            ];
        }
        status.priceLastUpdatedAt = priceFeeds[0].price.publishTime;
        status.balanceInWei -= pythFee;
        status.totalUpdates += 1;
        status.totalSpent += pythFee;

        emit PricesUpdated(subscriptionId, priceFeeds[0].price.publishTime);
    }

    /**
     * @notice Validates whether the update trigger criteria is met for a subscription. Reverts if not met.
     * @dev This function assumes that all updates in priceFeeds have the same timestamp. The caller is expected to enforce this invariant.
     * @param subscriptionId The ID of the subscription (needed for reading previous prices).
     * @param params The subscription's parameters struct.
     * @param status The subscription's status struct.
     * @param priceFeeds The array of price feeds to validate.
     */
    function _validateShouldUpdatePrices(
        uint256 subscriptionId,
        SubscriptionParams storage params,
        SubscriptionStatus storage status,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal view returns (bool) {
        // SECURITY NOTE: this check assumes that all updates in priceFeeds have the same timestamp.
        // The caller is expected to enforce this invariant.
        uint256 updateTimestamp = priceFeeds[0].price.publishTime;

        // Reject updates if they're older than the latest stored ones
        if (
            status.priceLastUpdatedAt > 0 &&
            updateTimestamp <= status.priceLastUpdatedAt
        ) {
            revert TimestampOlderThanLastUpdate(
                updateTimestamp,
                status.priceLastUpdatedAt
            );
        }

        // If updateOnHeartbeat is enabled and the heartbeat interval has passed, trigger update
        if (params.updateCriteria.updateOnHeartbeat) {
            uint256 lastUpdateTime = status.priceLastUpdatedAt;

            if (
                lastUpdateTime == 0 ||
                updateTimestamp >=
                lastUpdateTime + params.updateCriteria.heartbeatSeconds
            ) {
                return true;
            }
        }

        // If updateOnDeviation is enabled, check if any price has deviated enough
        if (params.updateCriteria.updateOnDeviation) {
            for (uint8 i = 0; i < priceFeeds.length; i++) {
                // Get the previous price feed for this price ID using subscriptionId
                PythStructs.PriceFeed storage previousFeed = _state
                    .priceUpdates[subscriptionId][priceFeeds[i].id];

                // If there's no previous price, this is the first update
                if (previousFeed.id == bytes32(0)) {
                    return true;
                }

                // Calculate the deviation percentage
                int64 currentPrice = priceFeeds[i].price.price;
                int64 previousPrice = previousFeed.price.price;

                // Skip if either price is zero to avoid division by zero
                if (previousPrice == 0 || currentPrice == 0) {
                    continue;
                }

                // Calculate absolute deviation basis points (scaled by 1e4)
                uint256 numerator = SignedMath.abs(
                    currentPrice - previousPrice
                );
                uint256 denominator = SignedMath.abs(previousPrice);
                uint256 deviationBps = Math.mulDiv(
                    numerator,
                    10_000,
                    denominator
                );

                // If deviation exceeds threshold, trigger update
                if (
                    deviationBps >= params.updateCriteria.deviationThresholdBps
                ) {
                    return true;
                }
            }
        }

        revert UpdateConditionsNotMet();
    }

    /// FETCH PRICES

    /**
     * @notice Internal helper function to retrieve price feeds for a subscription.
     * @param subscriptionId The ID of the subscription.
     * @param priceIds The specific price IDs requested, or empty array to get all.
     * @return priceFeeds An array of PriceFeed structs corresponding to the requested IDs.
     */
    function _getPricesInternal(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) internal view returns (PythStructs.PriceFeed[] memory priceFeeds) {
        if (!_state.subscriptionParams[subscriptionId].isActive) {
            revert InactiveSubscription();
        }

        SubscriptionParams storage params = _state.subscriptionParams[
            subscriptionId
        ];

        // If no price IDs provided, return all price feeds for the subscription
        if (priceIds.length == 0) {
            PythStructs.PriceFeed[]
                memory allFeeds = new PythStructs.PriceFeed[](
                    params.priceIds.length
                );
            for (uint8 i = 0; i < params.priceIds.length; i++) {
                PythStructs.PriceFeed storage priceFeed = _state.priceUpdates[
                    subscriptionId
                ][params.priceIds[i]];
                // Check if the price feed exists (price ID is valid and has been updated)
                if (priceFeed.id == bytes32(0)) {
                    revert InvalidPriceId(params.priceIds[i], bytes32(0));
                }
                allFeeds[i] = priceFeed;
            }
            return allFeeds;
        }

        // Return only the requested price feeds
        PythStructs.PriceFeed[]
            memory requestedFeeds = new PythStructs.PriceFeed[](
                priceIds.length
            );
        for (uint8 i = 0; i < priceIds.length; i++) {
            PythStructs.PriceFeed storage priceFeed = _state.priceUpdates[
                subscriptionId
            ][priceIds[i]];

            // Check if the price feed exists (price ID is valid and has been updated)
            if (priceFeed.id == bytes32(0)) {
                revert InvalidPriceId(priceIds[i], bytes32(0));
            }
            requestedFeeds[i] = priceFeed;
        }
        return requestedFeeds;
    }

    function getPricesUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    )
        external
        view
        override
        onlyWhitelistedReader(subscriptionId)
        returns (PythStructs.Price[] memory prices)
    {
        PythStructs.PriceFeed[] memory priceFeeds = _getPricesInternal(
            subscriptionId,
            priceIds
        );
        prices = new PythStructs.Price[](priceFeeds.length);
        for (uint i = 0; i < priceFeeds.length; i++) {
            prices[i] = priceFeeds[i].price;
        }
        return prices;
    }

    function getEmaPriceUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    )
        external
        view
        override
        onlyWhitelistedReader(subscriptionId)
        returns (PythStructs.Price[] memory prices)
    {
        PythStructs.PriceFeed[] memory priceFeeds = _getPricesInternal(
            subscriptionId,
            priceIds
        );
        prices = new PythStructs.Price[](priceFeeds.length);
        for (uint i = 0; i < priceFeeds.length; i++) {
            prices[i] = priceFeeds[i].emaPrice;
        }
        return prices;
    }

    /// BALANCE MANAGEMENT

    function addFunds(
        uint256 subscriptionId
    ) external payable override onlyManager(subscriptionId) {
        if (!_state.subscriptionParams[subscriptionId].isActive) {
            revert InactiveSubscription();
        }

        _state.subscriptionStatuses[subscriptionId].balanceInWei += msg.value;
    }

    function withdrawFunds(
        uint256 subscriptionId,
        uint256 amount
    ) external override onlyManager(subscriptionId) {
        SubscriptionStatus storage status = _state.subscriptionStatuses[
            subscriptionId
        ];
        SubscriptionParams storage params = _state.subscriptionParams[
            subscriptionId
        ];

        if (status.balanceInWei < amount) {
            revert InsufficientBalance();
        }

        // If subscription is active, ensure minimum balance is maintained
        if (params.isActive) {
            uint256 minimumBalance = this.getMinimumBalance(
                uint8(params.priceIds.length)
            );
            if (status.balanceInWei - amount < minimumBalance) {
                revert InsufficientBalance();
            }
        }

        status.balanceInWei -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send funds");
    }

    // FETCH SUBSCRIPTIONS

    function getSubscription(
        uint256 subscriptionId
    )
        external
        view
        override
        returns (
            SubscriptionParams memory params,
            SubscriptionStatus memory status
        )
    {
        return (
            _state.subscriptionParams[subscriptionId],
            _state.subscriptionStatuses[subscriptionId]
        );
    }

    // This function is intentionally public with no access control to allow keepers to discover active subscriptions
    function getActiveSubscriptions(
        uint256 startIndex,
        uint256 maxResults
    )
        external
        view
        override
        returns (
            uint256[] memory subscriptionIds,
            SubscriptionParams[] memory subscriptionParams,
            uint256 totalCount
        )
    {
        // Count active subscriptions first to determine total count
        // TODO: Optimize this. store numActiveSubscriptions or something.
        totalCount = 0;
        for (uint256 i = 1; i < _state.subscriptionNumber; i++) {
            if (_state.subscriptionParams[i].isActive) {
                totalCount++;
            }
        }

        // If startIndex is beyond the total count, return empty arrays
        if (startIndex >= totalCount) {
            return (new uint256[](0), new SubscriptionParams[](0), totalCount);
        }

        // Calculate how many results to return (bounded by maxResults and remaining items)
        uint256 resultCount = totalCount - startIndex;
        if (resultCount > maxResults) {
            resultCount = maxResults;
        }

        // Create arrays for subscription IDs and parameters
        subscriptionIds = new uint256[](resultCount);
        subscriptionParams = new SubscriptionParams[](resultCount);

        // Find and populate the requested page of active subscriptions
        uint256 activeIndex = 0;
        uint256 resultIndex = 0;

        for (
            uint256 i = 1;
            i < _state.subscriptionNumber && resultIndex < resultCount;
            i++
        ) {
            if (_state.subscriptionParams[i].isActive) {
                if (activeIndex >= startIndex) {
                    subscriptionIds[resultIndex] = i;
                    subscriptionParams[resultIndex] = _state.subscriptionParams[
                        i
                    ];
                    resultIndex++;
                }
                activeIndex++;
            }
        }

        return (subscriptionIds, subscriptionParams, totalCount);
    }

    /**
     * @notice Returns the minimum balance an active subscription of a given size needs to hold.
     * @param numPriceFeeds The number of price feeds in the subscription.
     */
    function getMinimumBalance(
        uint8 numPriceFeeds
    ) external pure override returns (uint256 minimumBalanceInWei) {
        // Simple implementation - minimum balance is 0.01 ETH per price feed
        return numPriceFeeds * 0.01 ether;
    }

    // ACCESS CONTROL MODIFIERS

    modifier onlyManager(uint256 subscriptionId) {
        if (_state.subscriptionManager[subscriptionId] != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyWhitelistedReader(uint256 subscriptionId) {
        // Manager is always allowed
        if (_state.subscriptionManager[subscriptionId] == msg.sender) {
            _;
            return;
        }

        // If whitelist is not used, allow any reader
        if (!_state.subscriptionParams[subscriptionId].whitelistEnabled) {
            _;
            return;
        }

        // Check if caller is in whitelist
        address[] storage whitelist = _state
            .subscriptionParams[subscriptionId]
            .readerWhitelist;
        bool isWhitelisted = false;
        for (uint i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == msg.sender) {
                isWhitelisted = true;
                break;
            }
        }

        if (!isWhitelisted) {
            revert Unauthorized();
        }
        _;
    }
}

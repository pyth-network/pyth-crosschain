// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
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

    function addSubscription(
        SubscriptionParams calldata subscriptionParams
    ) external override returns (uint256 subscriptionId) {
        if (subscriptionParams.priceIds.length > MAX_PRICE_IDS) {
            revert TooManyPriceIds(
                subscriptionParams.priceIds.length,
                MAX_PRICE_IDS
            );
        }

        // Validate update criteria
        if (
            !subscriptionParams.updateCriteria.updateOnHeartbeat &&
            !subscriptionParams.updateCriteria.updateOnDeviation
        ) {
            revert InvalidUpdateCriteria();
        }

        // Validate gas config
        if (
            subscriptionParams.gasConfig.maxGasPrice == 0 ||
            subscriptionParams.gasConfig.maxGasLimit == 0
        ) {
            revert InvalidGasConfig();
        }

        subscriptionId = _state.subscriptionNumber++;

        // Store the subscription parameters
        _state.subscriptionParams[subscriptionId] = subscriptionParams;

        // Initialize subscription status
        SubscriptionStatus storage status = _state.subscriptionStatuses[
            subscriptionId
        ];
        status.priceLastUpdatedAt = 0;
        status.balanceInWei = 0;
        status.totalUpdates = 0;
        status.totalSpent = 0;
        status.isActive = true;

        // Map subscription ID to manager
        _state.subscriptionManager[subscriptionId] = msg.sender;

        emit SubscriptionCreated(subscriptionId, msg.sender);
        return subscriptionId;
    }

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

    function updateSubscription(
        uint256 subscriptionId,
        SubscriptionParams calldata newSubscriptionParams
    ) external override onlyManager(subscriptionId) {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
            revert InactiveSubscription();
        }

        if (newSubscriptionParams.priceIds.length > MAX_PRICE_IDS) {
            revert TooManyPriceIds(
                newSubscriptionParams.priceIds.length,
                MAX_PRICE_IDS
            );
        }

        // Validate update criteria
        if (
            !newSubscriptionParams.updateCriteria.updateOnHeartbeat &&
            !newSubscriptionParams.updateCriteria.updateOnDeviation
        ) {
            revert InvalidUpdateCriteria();
        }

        // Validate gas config
        if (
            newSubscriptionParams.gasConfig.maxGasPrice == 0 ||
            newSubscriptionParams.gasConfig.maxGasLimit == 0
        ) {
            revert InvalidGasConfig();
        }

        // Update subscription parameters
        _state.subscriptionParams[subscriptionId] = newSubscriptionParams;

        emit SubscriptionUpdated(subscriptionId);
    }

    function deactivateSubscription(
        uint256 subscriptionId
    ) external override onlyManager(subscriptionId) {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
            revert InactiveSubscription();
        }

        _state.subscriptionStatuses[subscriptionId].isActive = false;

        emit SubscriptionDeactivated(subscriptionId);
    }

    function updatePriceFeeds(
        uint256 subscriptionId,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external override onlyPusher {
        SubscriptionStatus storage status = _state.subscriptionStatuses[
            subscriptionId
        ];
        SubscriptionParams storage params = _state.subscriptionParams[
            subscriptionId
        ];

        if (!status.isActive) {
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

    function getLatestPrices(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    )
        external
        view
        override
        onlyWhitelistedReader(subscriptionId)
        returns (PythStructs.PriceFeed[] memory)
    {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
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
                allFeeds[i] = _state.priceUpdates[subscriptionId][
                    params.priceIds[i]
                ];
            }
            return allFeeds;
        }

        // Return only the requested price feeds
        PythStructs.PriceFeed[]
            memory requestedFeeds = new PythStructs.PriceFeed[](
                priceIds.length
            );
        for (uint8 i = 0; i < priceIds.length; i++) {
            // Verify the requested price ID is part of the subscription
            bool validPriceId = false;
            for (uint8 j = 0; j < params.priceIds.length; j++) {
                if (priceIds[i] == params.priceIds[j]) {
                    validPriceId = true;
                    break;
                }
            }

            if (!validPriceId) {
                revert InvalidPriceId(priceIds[i], params.priceIds[0]);
            }

            requestedFeeds[i] = _state.priceUpdates[subscriptionId][
                priceIds[i]
            ];
        }

        return requestedFeeds;
    }

    function addFunds(
        uint256 subscriptionId
    ) external payable override onlyManager(subscriptionId) {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
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

        if (status.balanceInWei < amount) {
            revert InsufficientBalance();
        }

        status.balanceInWei -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send funds");
    }

    // This function is intentionally public with no access control to allow keepers to discover active subscriptions
    function getActiveSubscriptions()
        external
        view
        override
        returns (
            uint256[] memory subscriptionIds,
            SubscriptionParams[] memory subscriptionParams
        )
    {
        // TODO: This is gonna be expensive because we're iterating through
        // all subscriptions, including deactivated ones. But because its a view
        // function maybe it's not bad? We can optimize this.

        // Count active subscriptions first to determine array size
        uint256 activeCount = 0;
        for (uint256 i = 1; i < _state.subscriptionNumber; i++) {
            if (_state.subscriptionStatuses[i].isActive) {
                activeCount++;
            }
        }

        // Create arrays for subscription IDs and parameters
        subscriptionIds = new uint256[](activeCount);
        subscriptionParams = new SubscriptionParams[](activeCount);

        // Populate arrays with active subscription data
        uint256 index = 0;
        for (uint256 i = 1; i < _state.subscriptionNumber; i++) {
            if (_state.subscriptionStatuses[i].isActive) {
                subscriptionIds[index] = i;
                subscriptionParams[index] = _state.subscriptionParams[i];
                index++;
            }
        }

        return (subscriptionIds, subscriptionParams);
    }

    // ACCESS CONTROL MODIFIERS

    modifier onlyPusher() {
        // TODO: we may not make this permissioned.
        _;
    }

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

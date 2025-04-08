// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "./IScheduler.sol";
import "./SchedulerState.sol";
import "./SchedulerErrors.sol";

abstract contract Scheduler is IScheduler, SchedulerState {
    function _initialize(
        address admin,
        address pythAddress
    ) internal {
        require(admin != address(0), "admin is zero address");
        require(pythAddress != address(0), "pyth is zero address");

        _state.pyth = pythAddress;
        _state.subscriptionNumber = 1;
    }

    function addSubscription(
        SubscriptionParams calldata subscriptionParams
    ) external override returns (uint256 subscriptionId) {
        if (subscriptionParams.priceIds.length > MAX_PRICE_IDS) {
            revert TooManyPriceIds(subscriptionParams.priceIds.length, MAX_PRICE_IDS);
        }
        
        // Validate update criteria
        if (!subscriptionParams.updateCriteria.updateOnHeartbeat && 
            !subscriptionParams.updateCriteria.updateOnDeviation) {
            revert InvalidUpdateCriteria();
        }
        
        // Validate gas config
        if (subscriptionParams.gasConfig.maxGasPrice == 0 || 
            subscriptionParams.gasConfig.maxGasLimit == 0) {
            revert InvalidGasConfig();
        }

        subscriptionId = _state.subscriptionNumber++;
        
        // Store the subscription parameters
        _state.subscriptionParams[subscriptionId] = subscriptionParams;
        
        // Initialize subscription status
        SubscriptionStatus storage status = _state.subscriptionStatuses[subscriptionId];
        status.priceLastUpdatedAt = 0;
        status.balanceInWei = 0;
        status.totalUpdates = 0;
        status.totalSpent = 0;
        status.isActive = true;
        
        // Map manager to subscription ID
        _state.managerToSubscriptionId[msg.sender] = subscriptionId;
        
        emit SubscriptionCreated(subscriptionId, msg.sender);
        return subscriptionId;
    }

    function getSubscription(
        uint256 subscriptionId
    ) external view override returns (SubscriptionParams memory params, SubscriptionStatus memory status) {
        return (_state.subscriptionParams[subscriptionId], _state.subscriptionStatuses[subscriptionId]);
    }

    function updateSubscription(
        uint256 subscriptionId,
        SubscriptionParams calldata newSubscriptionParams
    ) external override onlyManager(subscriptionId) {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
            revert InactiveSubscription();
        }
        
        if (newSubscriptionParams.priceIds.length > MAX_PRICE_IDS) {
            revert TooManyPriceIds(newSubscriptionParams.priceIds.length, MAX_PRICE_IDS);
        }
        
        // Validate update criteria
        if (!newSubscriptionParams.updateCriteria.updateOnHeartbeat && 
            !newSubscriptionParams.updateCriteria.updateOnDeviation) {
            revert InvalidUpdateCriteria();
        }
        
        // Validate gas config
        if (newSubscriptionParams.gasConfig.maxGasPrice == 0 || 
            newSubscriptionParams.gasConfig.maxGasLimit == 0) {
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
        SubscriptionStatus storage status = _state.subscriptionStatuses[subscriptionId];
        SubscriptionParams storage params = _state.subscriptionParams[subscriptionId];
        
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
        
        // Parse price feed updates with the same timestamp for all feeds
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: pythFee
        }(
            updateData,
            priceIds,
            publishTime,
            publishTime
        );
        
        // Verify all price feeds have the same timestamp
        uint64 timestamp = SafeCast.toUint64(priceFeeds[0].price.publishTime);
        for (uint8 i = 1; i < priceFeeds.length; i++) {
            if (SafeCast.toUint64(priceFeeds[i].price.publishTime) != timestamp) {
                revert PriceTimestampMismatch();
            }
        }
        
        // Store the price updates in the mapping
        for (uint8 i = 0; i < priceFeeds.length; i++) {
            _state.priceUpdates[subscriptionId][priceIds[i]] = priceFeeds[i];
        }
        
        // Update subscription status
        status.priceLastUpdatedAt = timestamp;
        status.balanceInWei -= pythFee;
        status.totalUpdates += 1;
        status.totalSpent += pythFee;
        
        emit PricesUpdated(subscriptionId, timestamp);
    }

    function getLatestPrices(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view override onlyWhitelistedReader(subscriptionId) returns (PythStructs.PriceFeed[] memory) {
        if (!_state.subscriptionStatuses[subscriptionId].isActive) {
            revert InactiveSubscription();
        }
        
        SubscriptionParams storage params = _state.subscriptionParams[subscriptionId];
        
        // If no price IDs provided, return all price feeds for the subscription
        if (priceIds.length == 0) {
            PythStructs.PriceFeed[] memory allFeeds = new PythStructs.PriceFeed[](params.priceIds.length);
            for (uint8 i = 0; i < params.priceIds.length; i++) {
                allFeeds[i] = _state.priceUpdates[subscriptionId][params.priceIds[i]];
            }
            return allFeeds;
        }
        
        // Return only the requested price feeds
        PythStructs.PriceFeed[] memory requestedFeeds = new PythStructs.PriceFeed[](priceIds.length);
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
            
            requestedFeeds[i] = _state.priceUpdates[subscriptionId][priceIds[i]];
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
        SubscriptionStatus storage status = _state.subscriptionStatuses[subscriptionId];
        
        if (!status.isActive) {
            revert InactiveSubscription();
        }
        
        if (status.balanceInWei < amount) {
            revert InsufficientBalance();
        }
        
        status.balanceInWei -= amount;
        
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send funds");
    }

    // Helper functions for access control
    modifier onlyPusher() {
        // In a real implementation, this would check if the caller is an authorized pusher
        // For now, we'll allow any address to push updates
        _;
    }

    modifier onlyManager(uint256 subscriptionId) {
        if (_state.managerToSubscriptionId[msg.sender] != subscriptionId) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyWhitelistedReader(uint256 subscriptionId) {
        // Manager is always allowed
        if (_state.managerToSubscriptionId[msg.sender] == subscriptionId) {
            _;
            return;
        }
        
        // If whitelist is not used, allow any reader
        if (!_state.subscriptionParams[subscriptionId].useWhitelist) {
            _;
            return;
        }
        
        // Check if caller is in whitelist
        address[] storage whitelist = _state.subscriptionParams[subscriptionId].readerWhitelist;
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
    
    function getActiveSubscriptions() external view override returns (
        uint256[] memory subscriptionIds,
        SubscriptionParams[] memory subscriptionParams
    ) {
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
}

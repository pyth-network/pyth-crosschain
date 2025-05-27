// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../contracts/pulse/SchedulerUpgradeable.sol";
import "../../contracts/pulse/SchedulerState.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerStructs.sol";
import "./MockPriceFeedTestUtils.sol";

abstract contract PulseSchedulerTestUtils is Test, MockPriceFeedTestUtils {
    /// Helper function to add a test subscription with 2 price IDs
    function addTestSubscription(
        SchedulerUpgradeable scheduler,
        address whitelistedReader
    ) internal returns (uint256) {
        SchedulerStructs.SubscriptionParams
            memory params = createDefaultSubscriptionParams(
                2,
                whitelistedReader
            );
        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(params.priceIds.length)
        );
        return scheduler.createSubscription{value: minimumBalance}(params);
    }

    /// Helper function to add a test subscription with variable number of feeds
    function addTestSubscriptionWithFeeds(
        SchedulerUpgradeable scheduler,
        uint8 numFeeds,
        address whitelistedReader
    ) internal returns (uint256) {
        SchedulerStructs.SubscriptionParams
            memory params = createDefaultSubscriptionParams(
                numFeeds,
                whitelistedReader
            );
        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(params.priceIds.length)
        );
        return scheduler.createSubscription{value: minimumBalance}(params);
    }

    /// Helper function to add a test subscription with specific update criteria
    function addTestSubscriptionWithUpdateCriteria(
        SchedulerUpgradeable scheduler,
        SchedulerStructs.UpdateCriteria memory updateCriteria,
        address whitelistedReader
    ) internal returns (uint256) {
        bytes32[] memory priceIds = createPriceIds();
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = whitelistedReader;

        SchedulerStructs.SubscriptionParams memory params = SchedulerStructs
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria
            });

        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(params.priceIds.length)
        );
        return scheduler.createSubscription{value: minimumBalance}(params);
    }

    // Helper function to create default subscription parameters
    function createDefaultSubscriptionParams(
        uint8 numFeeds,
        address whitelistedReader
    ) internal pure returns (SchedulerStructs.SubscriptionParams memory) {
        bytes32[] memory priceIds = createPriceIds(numFeeds);
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = whitelistedReader;

        SchedulerStructs.UpdateCriteria memory updateCriteria = SchedulerStructs
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        return
            SchedulerStructs.SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria
            });
    }
}

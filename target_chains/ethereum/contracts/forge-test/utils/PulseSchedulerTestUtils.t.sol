// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../contracts/pulse/IPulse.sol";
import "../../contracts/pulse/scheduler/SchedulerState.sol";
import "./PulseTestUtils.t.sol";
import "../../contracts/pulse/scheduler/SchedulerUpgradeable.sol";

abstract contract PulseSchedulerTestUtils is Test, PulseTestUtils {
    /// Helper function to add a test subscription with 2 price IDs
    function addTestSubscription(
        SchedulerUpgradeable scheduler,
        address whitelistedReader
    ) internal returns (uint256) {
        SchedulerState.SubscriptionParams
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
        SchedulerState.SubscriptionParams
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
        SchedulerState.UpdateCriteria memory updateCriteria,
        address whitelistedReader
    ) internal returns (uint256) {
        bytes32[] memory priceIds = createPriceIds();
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = whitelistedReader;

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxBaseFeeMultiplierCapPct: 10_000,
            maxPriorityFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(priceIds.length)
        );
        return scheduler.createSubscription{value: minimumBalance}(params);
    }

    // Helper function to create default subscription parameters
    function createDefaultSubscriptionParams(
        uint8 numFeeds,
        address whitelistedReader
    ) internal pure returns (SchedulerState.SubscriptionParams memory) {
        bytes32[] memory priceIds = createPriceIds(numFeeds);
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = whitelistedReader;

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxBaseFeeMultiplierCapPct: 10_000,
            maxPriorityFeeMultiplierCapPct: 10_000
        });

        return
            SchedulerState.SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });
    }
}

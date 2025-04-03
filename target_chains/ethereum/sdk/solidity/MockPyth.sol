// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./AbstractPyth.sol";
import "./PythStructs.sol";
import "./PythErrors.sol";

contract MockPyth is AbstractPyth {
    mapping(bytes32 => PythStructs.PriceFeed) priceFeeds;

    uint singleUpdateFeeInWei;
    uint validTimePeriod;

    // Mock structure for TWAP price information
    struct MockTwapPriceInfo {
        int32 expo;
        int64 price;
        uint64 conf;
        uint64 publishTime;
        uint64 prevPublishTime;
        uint64 publishSlot;
        int128 cumulativePrice;
        uint128 cumulativeConf;
        uint64 numDownSlots;
    }

    constructor(uint _validTimePeriod, uint _singleUpdateFeeInWei) {
        singleUpdateFeeInWei = _singleUpdateFeeInWei;
        validTimePeriod = _validTimePeriod;
    }

    function queryPriceFeed(
        bytes32 id
    ) public view override returns (PythStructs.PriceFeed memory priceFeed) {
        if (priceFeeds[id].id == 0) revert PythErrors.PriceFeedNotFound();
        return priceFeeds[id];
    }

    function priceFeedExists(bytes32 id) public view override returns (bool) {
        return (priceFeeds[id].id != 0);
    }

    function getValidTimePeriod() public view override returns (uint) {
        return validTimePeriod;
    }

    // Takes an array of encoded price feeds and stores them.
    // You can create this data either by calling createPriceFeedUpdateData or
    // by using web3.js or ethers abi utilities.
    // @note: The updateData expected here is different from the one used in the main contract.
    // In particular, the expected format is:
    // [
    //     abi.encode(
    //         PythStructs.PriceFeed(
    //             bytes32 id,
    //             PythStructs.Price price,
    //             PythStructs.Price emaPrice
    //         ),
    //         uint64 prevPublishTime
    //     )
    // ]
    function updatePriceFeeds(
        bytes[] calldata updateData
    ) public payable override {
        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        for (uint i = 0; i < updateData.length; i++) {
            PythStructs.PriceFeed memory priceFeed = abi.decode(
                updateData[i],
                (PythStructs.PriceFeed)
            );

            uint lastPublishTime = priceFeeds[priceFeed.id].price.publishTime;

            if (lastPublishTime < priceFeed.price.publishTime) {
                // Price information is more recent than the existing price information.
                priceFeeds[priceFeed.id] = priceFeed;
                emit PriceFeedUpdate(
                    priceFeed.id,
                    uint64(priceFeed.price.publishTime),
                    priceFeed.price.price,
                    priceFeed.price.conf
                );
            }
        }
    }

    function getUpdateFee(
        bytes[] calldata updateData
    ) public view override returns (uint feeAmount) {
        return singleUpdateFeeInWei * updateData.length;
    }

    function parsePriceFeedUpdatesInternal(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime,
        bool unique
    ) internal returns (PythStructs.PriceFeed[] memory feeds) {
        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        feeds = new PythStructs.PriceFeed[](priceIds.length);

        for (uint i = 0; i < priceIds.length; i++) {
            for (uint j = 0; j < updateData.length; j++) {
                uint64 prevPublishTime;
                (feeds[i], prevPublishTime) = abi.decode(
                    updateData[j],
                    (PythStructs.PriceFeed, uint64)
                );

                uint publishTime = feeds[i].price.publishTime;
                if (priceFeeds[feeds[i].id].price.publishTime < publishTime) {
                    priceFeeds[feeds[i].id] = feeds[i];
                    emit PriceFeedUpdate(
                        feeds[i].id,
                        uint64(publishTime),
                        feeds[i].price.price,
                        feeds[i].price.conf
                    );
                }

                if (feeds[i].id == priceIds[i]) {
                    if (
                        minPublishTime <= publishTime &&
                        publishTime <= maxPublishTime &&
                        (!unique || prevPublishTime < minPublishTime)
                    ) {
                        break;
                    } else {
                        feeds[i].id = 0;
                    }
                }
            }

            if (feeds[i].id != priceIds[i])
                revert PythErrors.PriceFeedNotFoundWithinRange();
        }
    }

    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
        return
            parsePriceFeedUpdatesInternal(
                updateData,
                priceIds,
                minPublishTime,
                maxPublishTime,
                false
            );
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
        return
            parsePriceFeedUpdatesInternal(
                updateData,
                priceIds,
                minPublishTime,
                maxPublishTime,
                true
            );
    }

    function parseTwapPriceFeedUpdates(
        bytes[][] calldata updateData,
        bytes32[] calldata priceIds
    )
        external
        payable
        returns (PythStructs.TwapPriceFeed[] memory twapPriceFeeds)
    {
        // Validate inputs and fee
        if (updateData.length != 2) revert PythErrors.InvalidUpdateData();

        uint requiredFee = getUpdateFee(updateData[0]);
        if (requiredFee != getUpdateFee(updateData[1]))
            revert PythErrors.InvalidUpdateData();
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        twapPriceFeeds = new PythStructs.TwapPriceFeed[](priceIds.length);

        // Process each price ID
        for (uint i = 0; i < priceIds.length; i++) {
            processTwapPriceFeed(updateData, priceIds[i], i, twapPriceFeeds);
        }
    }

    function processTwapPriceFeed(
        bytes[][] calldata updateData,
        bytes32 priceId,
        uint index,
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds
    ) private {
        // Find start price feed
        PythStructs.PriceFeed memory startFeed;
        uint64 startPrevPublishTime;
        bool foundStart = false;

        for (uint j = 0; j < updateData[0].length; j++) {
            (startFeed, startPrevPublishTime) = abi.decode(
                updateData[0][j],
                (PythStructs.PriceFeed, uint64)
            );

            if (startFeed.id == priceId) {
                foundStart = true;
                break;
            }
        }

        if (!foundStart) revert PythErrors.PriceFeedNotFoundWithinRange();

        // Find end price feed
        PythStructs.PriceFeed memory endFeed;
        uint64 endPrevPublishTime;
        bool foundEnd = false;

        for (uint j = 0; j < updateData[1].length; j++) {
            (endFeed, endPrevPublishTime) = abi.decode(
                updateData[1][j],
                (PythStructs.PriceFeed, uint64)
            );

            if (endFeed.id == priceId) {
                foundEnd = true;
                break;
            }
        }

        if (!foundEnd) revert PythErrors.PriceFeedNotFoundWithinRange();

        // Validate time ordering
        if (startFeed.price.publishTime >= endFeed.price.publishTime) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }

        // Convert to MockTwapPriceInfo
        MockTwapPriceInfo memory startInfo = createMockTwapInfo(
            startFeed,
            startPrevPublishTime
        );
        MockTwapPriceInfo memory endInfo = createMockTwapInfo(
            endFeed,
            endPrevPublishTime
        );

        if (startInfo.publishSlot >= endInfo.publishSlot) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }

        // Calculate and store TWAP
        twapPriceFeeds[index] = calculateTwap(priceId, startInfo, endInfo);

        // Emit event in a separate function to reduce stack depth
        emitTwapUpdate(
            priceId,
            startInfo.publishTime,
            endInfo.publishTime,
            twapPriceFeeds[index]
        );
    }

    function emitTwapUpdate(
        bytes32 priceId,
        uint64 startTime,
        uint64 endTime,
        PythStructs.TwapPriceFeed memory twapFeed
    ) private {
        emit TwapPriceFeedUpdate(
            priceId,
            startTime,
            endTime,
            twapFeed.twap.price,
            twapFeed.twap.conf,
            twapFeed.downSlotsRatio
        );
    }

    function createMockTwapInfo(
        PythStructs.PriceFeed memory feed,
        uint64 prevPublishTime
    ) internal pure returns (MockTwapPriceInfo memory mockInfo) {
        mockInfo.expo = feed.price.expo;
        mockInfo.price = feed.price.price;
        mockInfo.conf = feed.price.conf;
        mockInfo.publishTime = uint64(feed.price.publishTime);
        mockInfo.prevPublishTime = prevPublishTime;

        // Use publishTime as publishSlot in mock implementation
        mockInfo.publishSlot = uint64(feed.price.publishTime);

        // Create mock cumulative values for demonstration
        // In a real implementation, these would accumulate over time
        mockInfo.cumulativePrice =
            int128(feed.price.price) *
            int128(uint128(mockInfo.publishSlot));
        mockInfo.cumulativeConf =
            uint128(feed.price.conf) *
            uint128(mockInfo.publishSlot);

        // Default to 0 down slots for mock
        mockInfo.numDownSlots = 0;

        return mockInfo;
    }

    function calculateTwap(
        bytes32 priceId,
        MockTwapPriceInfo memory twapPriceInfoStart,
        MockTwapPriceInfo memory twapPriceInfoEnd
    ) internal pure returns (PythStructs.TwapPriceFeed memory twapPriceFeed) {
        twapPriceFeed.id = priceId;
        twapPriceFeed.startTime = twapPriceInfoStart.publishTime;
        twapPriceFeed.endTime = twapPriceInfoEnd.publishTime;

        // Calculate differences between start and end points for slots and cumulative values
        uint64 slotDiff = twapPriceInfoEnd.publishSlot -
            twapPriceInfoStart.publishSlot;
        int128 priceDiff = twapPriceInfoEnd.cumulativePrice -
            twapPriceInfoStart.cumulativePrice;
        uint128 confDiff = twapPriceInfoEnd.cumulativeConf -
            twapPriceInfoStart.cumulativeConf;

        // Calculate time-weighted average price (TWAP) and confidence
        int128 twapPrice = priceDiff / int128(uint128(slotDiff));
        uint128 twapConf = confDiff / uint128(slotDiff);

        twapPriceFeed.twap.price = int64(twapPrice);
        twapPriceFeed.twap.conf = uint64(twapConf);
        twapPriceFeed.twap.expo = twapPriceInfoStart.expo;
        twapPriceFeed.twap.publishTime = twapPriceInfoEnd.publishTime;

        // Calculate downSlotsRatio as a value between 0 and 1,000,000
        uint64 totalDownSlots = twapPriceInfoEnd.numDownSlots -
            twapPriceInfoStart.numDownSlots;
        uint64 downSlotsRatio = (totalDownSlots * 1_000_000) / slotDiff;

        // Safely downcast to uint32 (sufficient for value range 0-1,000,000)
        twapPriceFeed.downSlotsRatio = uint32(downSlotsRatio);

        return twapPriceFeed;
    }

    function createPriceFeedUpdateData(
        bytes32 id,
        int64 price,
        uint64 conf,
        int32 expo,
        int64 emaPrice,
        uint64 emaConf,
        uint64 publishTime,
        uint64 prevPublishTime
    ) public pure returns (bytes memory priceFeedData) {
        PythStructs.PriceFeed memory priceFeed;

        priceFeed.id = id;

        priceFeed.price.price = price;
        priceFeed.price.conf = conf;
        priceFeed.price.expo = expo;
        priceFeed.price.publishTime = publishTime;

        priceFeed.emaPrice.price = emaPrice;
        priceFeed.emaPrice.conf = emaConf;
        priceFeed.emaPrice.expo = expo;
        priceFeed.emaPrice.publishTime = publishTime;

        priceFeedData = abi.encode(priceFeed, prevPublishTime);
    }
}

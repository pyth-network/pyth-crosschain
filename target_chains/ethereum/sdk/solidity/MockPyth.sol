// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./AbstractPyth.sol";
import "./PythStructs.sol";
import "./PythErrors.sol";
import "./PythUtils.sol";

contract MockPyth is AbstractPyth {
    mapping(bytes32 => PythStructs.PriceFeed) priceFeeds;

    uint singleUpdateFeeInWei;
    uint validTimePeriod;

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
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    )
        external
        payable
        override
        returns (PythStructs.TwapPriceFeed[] memory twapPriceFeeds)
    {
        // Validate inputs and fee
        if (updateData.length != 2) revert PythErrors.InvalidUpdateData();

        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        twapPriceFeeds = new PythStructs.TwapPriceFeed[](priceIds.length);

        // Process each price ID
        for (uint i = 0; i < priceIds.length; i++) {
            processTwapPriceFeed(updateData, priceIds[i], i, twapPriceFeeds);
        }

        return twapPriceFeeds;
    }

    function findPriceFeed(
        bytes[] calldata updateData,
        bytes32 priceId,
        uint index
    )
        private
        pure
        returns (
            PythStructs.PriceFeed memory feed,
            uint64 prevPublishTime,
            bool found
        )
    {
        (feed, prevPublishTime) = abi.decode(
            updateData[index],
            (PythStructs.PriceFeed, uint64)
        );

        if (feed.id == priceId) {
            found = true;
        }
    }

    function processTwapPriceFeed(
        bytes[] calldata updateData,
        bytes32 priceId,
        uint index,
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds
    ) private {
        // Decode start and end TWAP info
        (bytes32 startId, PythStructs.TwapPriceInfo memory startInfo) = abi
            .decode(updateData[0], (bytes32, PythStructs.TwapPriceInfo));
        (bytes32 endId, PythStructs.TwapPriceInfo memory endInfo) = abi.decode(
            updateData[1],
            (bytes32, PythStructs.TwapPriceInfo)
        );

        // Validate IDs match
        if (startId != priceId || endId != priceId)
            revert PythErrors.InvalidTwapUpdateDataSet();

        // Validate time ordering
        if (startInfo.publishTime >= endInfo.publishTime) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }

        if (startInfo.publishSlot >= endInfo.publishSlot) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }

        // Calculate TWAP
        twapPriceFeeds[index] = PythUtils.calculateTwap(
            priceId,
            startInfo,
            endInfo
        );

        // Emit event
        emit TwapPriceFeedUpdate(
            priceId,
            startInfo.publishTime,
            endInfo.publishTime,
            twapPriceFeeds[index].twap.price,
            twapPriceFeeds[index].twap.conf,
            twapPriceFeeds[index].downSlotsRatio
        );
    }

    /**
     * @notice Creates TWAP price feed update data with simplified parameters for testing
     * @param id The price feed ID
     * @param price The price value
     * @param conf The confidence interval
     * @param expo Price exponent
     * @param publishTime Timestamp when price was published
     * @param publishSlot Slot number for this update
     * @return twapData Encoded TWAP price feed data ready for parseTwapPriceFeedUpdates
     */
    function createTwapPriceFeedUpdateData(
        bytes32 id,
        int64 price,
        uint64 conf,
        int32 expo,
        uint64 publishTime,
        uint64 publishSlot
    ) public pure returns (bytes memory twapData) {
        PythStructs.TwapPriceInfo memory twapInfo;
        // Calculate cumulative values based on single price point
        twapInfo.cumulativePrice = int128(price);
        twapInfo.cumulativeConf = uint128(conf);
        twapInfo.numDownSlots = 0; // Assume no down slots for test data
        twapInfo.expo = expo;
        twapInfo.publishTime = publishTime;
        twapInfo.prevPublishTime = publishTime > 60 ? publishTime - 60 : 0; // Set a reasonable previous time
        twapInfo.publishSlot = publishSlot;

        twapData = abi.encode(id, twapInfo);
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

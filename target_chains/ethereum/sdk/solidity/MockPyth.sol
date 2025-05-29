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

    function getTwapUpdateFee(
        bytes[] calldata updateData
    ) public view override returns (uint feeAmount) {
        return singleUpdateFeeInWei * updateData.length;
    }

    function parsePriceFeedUpdatesWithConfig(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minAllowedPublishTime,
        uint64 maxAllowedPublishTime,
        bool checkUniqueness,
        bool checkUpdateDataIsMinimal,
        bool storeUpdatesIfFresh
    )
        public
        payable
        returns (PythStructs.PriceFeed[] memory feeds, uint64[] memory slots)
    {
        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        feeds = new PythStructs.PriceFeed[](priceIds.length);
        slots = new uint64[](priceIds.length);

        for (uint i = 0; i < priceIds.length; i++) {
            for (uint j = 0; j < updateData.length; j++) {
                uint64 prevPublishTime;
                (feeds[i], prevPublishTime) = abi.decode(
                    updateData[j],
                    (PythStructs.PriceFeed, uint64)
                );

                uint publishTime = feeds[i].price.publishTime;
                slots[i] = uint64(publishTime); // use PublishTime as mock slot
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
                        minAllowedPublishTime <= publishTime &&
                        publishTime <= maxAllowedPublishTime &&
                        (!checkUniqueness ||
                            prevPublishTime < minAllowedPublishTime)
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
        (feeds, ) = parsePriceFeedUpdatesWithConfig(
            updateData,
            priceIds,
            minPublishTime,
            maxPublishTime,
            false,
            true,
            false
        );
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
        (feeds, ) = parsePriceFeedUpdatesWithConfig(
            updateData,
            priceIds,
            minPublishTime,
            maxPublishTime,
            false,
            true,
            false
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
        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        twapPriceFeeds = new PythStructs.TwapPriceFeed[](priceIds.length);

        // Process each price ID
        for (uint i = 0; i < priceIds.length; i++) {
            processTwapPriceFeed(updateData, priceIds[i], i, twapPriceFeeds);
        }

        return twapPriceFeeds;
    }

    // You can create this data either by calling createTwapPriceFeedUpdateData.
    // @note: The updateData expected here is different from the one used in the main contract.
    // In particular, the expected format is:
    // [
    //     abi.encode(
    //         bytes32 id,
    //         PythStructs.TwapPriceInfo startInfo,
    //         PythStructs.TwapPriceInfo endInfo
    //     )
    // ]
    function processTwapPriceFeed(
        bytes[] calldata updateData,
        bytes32 priceId,
        uint index,
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds
    ) private {
        // Decode TWAP feed directly
        PythStructs.TwapPriceFeed memory twapFeed = abi.decode(
            updateData[0],
            (PythStructs.TwapPriceFeed)
        );

        // Validate ID matches
        if (twapFeed.id != priceId)
            revert PythErrors.InvalidTwapUpdateDataSet();

        // Store the TWAP feed
        twapPriceFeeds[index] = twapFeed;

        // Emit event
        emit TwapPriceFeedUpdate(
            priceId,
            twapFeed.startTime,
            twapFeed.endTime,
            twapFeed.twap.price,
            twapFeed.twap.conf,
            twapFeed.downSlotsRatio
        );
    }

    /**
     * @notice Creates TWAP price feed update data with simplified parameters for testing
     * @param id The price feed ID
     * @param startTime Start time of the TWAP
     * @param endTime End time of the TWAP
     * @param price The price value
     * @param conf The confidence interval
     * @param expo Price exponent
     * @param downSlotsRatio Down slots ratio
     * @return twapData Encoded TWAP price feed data ready for parseTwapPriceFeedUpdates
     */
    function createTwapPriceFeedUpdateData(
        bytes32 id,
        uint64 startTime,
        uint64 endTime,
        int64 price,
        uint64 conf,
        int32 expo,
        uint32 downSlotsRatio
    ) public pure returns (bytes memory twapData) {
        PythStructs.Price memory twapPrice = PythStructs.Price({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: endTime
        });

        PythStructs.TwapPriceFeed memory twapFeed = PythStructs.TwapPriceFeed({
            id: id,
            startTime: startTime,
            endTime: endTime,
            twap: twapPrice,
            downSlotsRatio: downSlotsRatio
        });

        twapData = abi.encode(twapFeed);
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

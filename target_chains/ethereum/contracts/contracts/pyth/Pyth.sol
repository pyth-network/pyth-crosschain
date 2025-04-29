// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/UnsafeBytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "./PythAccumulator.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythInternalStructs.sol";
abstract contract Pyth is
    PythGetters,
    PythSetters,
    AbstractPyth,
    PythAccumulator
{
    function _initialize(
        address wormhole,
        uint16[] calldata dataSourceEmitterChainIds,
        bytes32[] calldata dataSourceEmitterAddresses,
        uint16 governanceEmitterChainId,
        bytes32 governanceEmitterAddress,
        uint64 governanceInitialSequence,
        uint validTimePeriodSeconds,
        uint singleUpdateFeeInWei
    ) internal {
        setWormhole(wormhole);

        if (
            dataSourceEmitterChainIds.length !=
            dataSourceEmitterAddresses.length
        ) revert PythErrors.InvalidArgument();

        for (uint i = 0; i < dataSourceEmitterChainIds.length; i++) {
            PythInternalStructs.DataSource memory ds = PythInternalStructs
                .DataSource(
                    dataSourceEmitterChainIds[i],
                    dataSourceEmitterAddresses[i]
                );

            if (PythGetters.isValidDataSource(ds.chainId, ds.emitterAddress))
                revert PythErrors.InvalidArgument();

            _state.isValidDataSource[hashDataSource(ds)] = true;
            _state.validDataSources.push(ds);
        }

        {
            PythInternalStructs.DataSource memory ds = PythInternalStructs
                .DataSource(governanceEmitterChainId, governanceEmitterAddress);
            PythSetters.setGovernanceDataSource(ds);
            PythSetters.setLastExecutedGovernanceSequence(
                governanceInitialSequence
            );
        }

        PythSetters.setValidTimePeriodSeconds(validTimePeriodSeconds);
        PythSetters.setSingleUpdateFeeInWei(singleUpdateFeeInWei);
    }

    function updatePriceFeeds(
        bytes[] calldata updateData
    ) public payable override {
        uint totalNumUpdates = 0;
        for (uint i = 0; i < updateData.length; ) {
            totalNumUpdates += updatePriceInfosFromAccumulatorUpdate(
                updateData[i]
            );

            unchecked {
                i++;
            }
        }
        uint requiredFee = getTotalFee(totalNumUpdates);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();
    }

    /// This method is deprecated, please use the `getUpdateFee(bytes[])` instead.
    function getUpdateFee(
        uint updateDataSize
    ) public view returns (uint feeAmount) {
        // In the accumulator update data a single update can contain
        // up to 255 messages and we charge a singleUpdateFee per each
        // message
        return
            255 *
            singleUpdateFeeInWei() *
            updateDataSize +
            transactionFeeInWei();
    }

    function getUpdateFee(
        bytes[] calldata updateData
    ) public view override returns (uint feeAmount) {
        uint totalNumUpdates = 0;
        for (uint i = 0; i < updateData.length; i++) {
            if (
                updateData[i].length > 4 &&
                UnsafeCalldataBytesLib.toUint32(updateData[i], 0) ==
                ACCUMULATOR_MAGIC
            ) {
                (
                    uint offset,
                    UpdateType updateType
                ) = extractUpdateTypeFromAccumulatorHeader(updateData[i]);
                if (updateType != UpdateType.WormholeMerkle) {
                    revert PythErrors.InvalidUpdateData();
                }
                totalNumUpdates += parseWormholeMerkleHeaderNumUpdates(
                    updateData[i],
                    offset
                );
            } else {
                revert PythErrors.InvalidUpdateData();
            }
        }
        return getTotalFee(totalNumUpdates);
    }

    // This is an overwrite of the same method in AbstractPyth.sol
    // to be more gas efficient.
    function updatePriceFeedsIfNecessary(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64[] calldata publishTimes
    ) external payable override {
        if (priceIds.length != publishTimes.length)
            revert PythErrors.InvalidArgument();

        for (uint i = 0; i < priceIds.length; ) {
            // If the price does not exist, then the publish time is zero and
            // this condition will work fine.
            if (latestPriceInfoPublishTime(priceIds[i]) < publishTimes[i]) {
                updatePriceFeeds(updateData);
                return;
            }

            unchecked {
                i++;
            }
        }

        revert PythErrors.NoFreshUpdate();
    }

    // This is an overwrite of the same method in AbstractPyth.sol
    // to be more gas efficient. It cannot move to PythGetters as it
    // is overwriting the interface. Even indirect calling of a similar
    // method from PythGetter has some gas overhead.
    function getPriceUnsafe(
        bytes32 id
    ) public view override returns (PythStructs.Price memory price) {
        PythInternalStructs.PriceInfo storage info = _state.latestPriceInfo[id];
        price.publishTime = info.publishTime;
        price.expo = info.expo;
        price.price = info.price;
        price.conf = info.conf;

        if (price.publishTime == 0) revert PythErrors.PriceFeedNotFound();
    }

    // This is an overwrite of the same method in AbstractPyth.sol
    // to be more gas efficient. It cannot move to PythGetters as it
    // is overwriting the interface. Even indirect calling of a similar
    // method from PythGetter has some gas overhead.
    function getEmaPriceUnsafe(
        bytes32 id
    ) public view override returns (PythStructs.Price memory price) {
        PythInternalStructs.PriceInfo storage info = _state.latestPriceInfo[id];
        price.publishTime = info.publishTime;
        price.expo = info.expo;
        price.price = info.emaPrice;
        price.conf = info.emaConf;

        if (price.publishTime == 0) revert PythErrors.PriceFeedNotFound();
    }

    /// @dev Helper function to parse a single price update within a Merkle proof.
    /// Parsed price feeds will be stored in the context.
    function _parseSingleMerkleUpdate(
        PythInternalStructs.MerkleData memory merkleData,
        bytes calldata encoded,
        uint offset,
        PythInternalStructs.UpdateParseContext memory context
    ) internal pure returns (uint newOffset) {
        PythInternalStructs.PriceInfo memory priceInfo;
        bytes32 priceId;
        uint64 prevPublishTime;

        (
            newOffset,
            priceInfo,
            priceId,
            prevPublishTime
        ) = extractPriceInfoFromMerkleProof(merkleData.digest, encoded, offset);

        uint k = 0;
        for (; k < context.priceIds.length; k++) {
            if (context.priceIds[k] == priceId) {
                break;
            }
        }

        // Check if the priceId was requested and not already filled
        if (k < context.priceIds.length && context.priceFeeds[k].id == 0) {
            uint publishTime = uint(priceInfo.publishTime);
            if (
                publishTime >= context.config.minPublishTime &&
                publishTime <= context.config.maxPublishTime &&
                (!context.config.checkUniqueness ||
                    context.config.minPublishTime > prevPublishTime)
            ) {
                context.priceFeeds[k].id = priceId;
                context.priceFeeds[k].price.price = priceInfo.price;
                context.priceFeeds[k].price.conf = priceInfo.conf;
                context.priceFeeds[k].price.expo = priceInfo.expo;
                context.priceFeeds[k].price.publishTime = publishTime;
                context.priceFeeds[k].emaPrice.price = priceInfo.emaPrice;
                context.priceFeeds[k].emaPrice.conf = priceInfo.emaConf;
                context.priceFeeds[k].emaPrice.expo = priceInfo.expo;
                context.priceFeeds[k].emaPrice.publishTime = publishTime;
                context.slots[k] = merkleData.slot;
            }
        }
    }

    /// @dev Processes a single entry from the updateData array.
    function _processSingleUpdateDataBlob(
        bytes calldata singleUpdateData,
        PythInternalStructs.UpdateParseContext memory context
    ) internal view {
        // Check magic number and length first
        if (
            singleUpdateData.length <= 4 ||
            UnsafeCalldataBytesLib.toUint32(singleUpdateData, 0) !=
            ACCUMULATOR_MAGIC
        ) {
            revert PythErrors.InvalidUpdateData();
        }

        uint offset;
        {
            UpdateType updateType;
            (offset, updateType) = extractUpdateTypeFromAccumulatorHeader(
                singleUpdateData
            );

            if (updateType != UpdateType.WormholeMerkle) {
                revert PythErrors.InvalidUpdateData();
            }
        }

        // Extract Merkle data
        PythInternalStructs.MerkleData memory merkleData;
        bytes calldata encoded;
        (
            offset,
            merkleData.digest,
            merkleData.numUpdates,
            encoded,
            merkleData.slot
        ) = extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedAndSlotFromAccumulatorUpdate(
            singleUpdateData,
            offset
        );

        // Process each update within the Merkle proof
        for (uint j = 0; j < merkleData.numUpdates; j++) {
            offset = _parseSingleMerkleUpdate(
                merkleData,
                encoded,
                offset,
                context
            );
        }

        // Check final offset
        if (offset != encoded.length) {
            revert PythErrors.InvalidUpdateData();
        }
    }

    function parsePriceFeedUpdatesInternal(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        PythInternalStructs.ParseConfig memory config
    )
        internal
        returns (
            PythStructs.PriceFeed[] memory priceFeeds,
            uint64[] memory slots
        )
    {
        {
            uint requiredFee = getUpdateFee(updateData);
            if (msg.value < requiredFee) revert PythErrors.InsufficientFee();
        }

        // In minimal update data mode, revert if we have more or less updates than price IDs
        if (config.checkUpdateDataIsMinimal) {
            uint64 totalUpdatesAcrossBlobs = 0;
            for (uint i = 0; i < updateData.length; i++) {
                (uint offset, ) = extractUpdateTypeFromAccumulatorHeader(
                    updateData[i]
                );

                totalUpdatesAcrossBlobs += parseWormholeMerkleHeaderNumUpdates(
                    updateData[i],
                    offset
                );
            }
            if (totalUpdatesAcrossBlobs != priceIds.length) {
                revert PythErrors.InvalidArgument();
            }
        }

        // Create the context struct that holds all shared parameters
        PythInternalStructs.UpdateParseContext memory context;
        context.priceIds = priceIds;
        context.config = config;
        context.priceFeeds = new PythStructs.PriceFeed[](priceIds.length);
        context.slots = new uint64[](priceIds.length);

        unchecked {
            // Process each update, passing the context struct
            // Parsed results will be filled in context.priceFeeds and context.slots
            for (uint i = 0; i < updateData.length; i++) {
                _processSingleUpdateDataBlob(updateData[i], context);
            }
        }

        // Check all price feeds were found
        for (uint k = 0; k < priceIds.length; k++) {
            if (context.priceFeeds[k].id == 0) {
                revert PythErrors.PriceFeedNotFoundWithinRange();
            }
        }

        // Return results
        return (context.priceFeeds, context.slots);
    }
    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    )
        external
        payable
        override
        returns (PythStructs.PriceFeed[] memory priceFeeds)
    {
        (priceFeeds, ) = parsePriceFeedUpdatesInternal(
            updateData,
            priceIds,
            PythInternalStructs.ParseConfig(
                minPublishTime,
                maxPublishTime,
                false,
                false
            )
        );
    }

    function parsePriceFeedUpdatesWithSlotsStrict(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    )
        external
        payable
        override
        returns (
            PythStructs.PriceFeed[] memory priceFeeds,
            uint64[] memory slots
        )
    {
        return
            parsePriceFeedUpdatesInternal(
                updateData,
                priceIds,
                PythInternalStructs.ParseConfig(
                    minPublishTime,
                    maxPublishTime,
                    false,
                    true
                )
            );
    }

    function processSingleTwapUpdate(
        bytes calldata updateData
    )
        private
        view
        returns (
            /// @return newOffset The next position in the update data after processing this TWAP update
            /// @return twapPriceInfo The extracted time-weighted average price information
            /// @return priceId The unique identifier for this price feed
            uint newOffset,
            PythStructs.TwapPriceInfo memory twapPriceInfo,
            bytes32 priceId
        )
    {
        UpdateType updateType;
        uint offset;
        bytes20 digest;
        uint8 numUpdates;
        bytes calldata encoded;
        // Extract and validate the header for start data
        (offset, updateType) = extractUpdateTypeFromAccumulatorHeader(
            updateData
        );

        if (updateType != UpdateType.WormholeMerkle) {
            revert PythErrors.InvalidUpdateData();
        }

        (
            offset,
            digest,
            numUpdates,
            encoded,
            // slot ignored

        ) = extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedAndSlotFromAccumulatorUpdate(
            updateData,
            offset
        );

        // Add additional validation before extracting TWAP price info
        if (offset >= updateData.length) {
            revert PythErrors.InvalidUpdateData();
        }

        // Extract start TWAP data with robust error checking
        (offset, twapPriceInfo, priceId) = extractTwapPriceInfoFromMerkleProof(
            digest,
            encoded,
            offset
        );

        if (offset != encoded.length) {
            revert PythErrors.InvalidTwapUpdateData();
        }
        newOffset = offset;
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
        // TWAP requires exactly 2 updates - one for the start point and one for the end point
        // to calculate the time-weighted average price between those two points
        if (updateData.length != 2) {
            revert PythErrors.InvalidUpdateData();
        }

        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        unchecked {
            twapPriceFeeds = new PythStructs.TwapPriceFeed[](priceIds.length);
            for (uint i = 0; i < updateData.length - 1; i++) {
                if (
                    (updateData[i].length > 4 &&
                        UnsafeCalldataBytesLib.toUint32(updateData[i], 0) ==
                        ACCUMULATOR_MAGIC) &&
                    (updateData[i + 1].length > 4 &&
                        UnsafeCalldataBytesLib.toUint32(updateData[i + 1], 0) ==
                        ACCUMULATOR_MAGIC)
                ) {
                    uint offsetStart;
                    uint offsetEnd;
                    bytes32 priceIdStart;
                    bytes32 priceIdEnd;
                    PythStructs.TwapPriceInfo memory twapPriceInfoStart;
                    PythStructs.TwapPriceInfo memory twapPriceInfoEnd;
                    (
                        offsetStart,
                        twapPriceInfoStart,
                        priceIdStart
                    ) = processSingleTwapUpdate(updateData[i]);
                    (
                        offsetEnd,
                        twapPriceInfoEnd,
                        priceIdEnd
                    ) = processSingleTwapUpdate(updateData[i + 1]);

                    if (priceIdStart != priceIdEnd)
                        revert PythErrors.InvalidTwapUpdateDataSet();

                    validateTwapPriceInfo(twapPriceInfoStart, twapPriceInfoEnd);

                    uint k = findIndexOfPriceId(priceIds, priceIdStart);

                    // If priceFeed[k].id != 0 then it means that there was a valid
                    // update for priceIds[k] and we don't need to process this one.
                    if (k == priceIds.length || twapPriceFeeds[k].id != 0) {
                        continue;
                    }

                    twapPriceFeeds[k] = calculateTwap(
                        priceIdStart,
                        twapPriceInfoStart,
                        twapPriceInfoEnd
                    );
                } else {
                    revert PythErrors.InvalidUpdateData();
                }
            }

            for (uint k = 0; k < priceIds.length; k++) {
                if (twapPriceFeeds[k].id == 0) {
                    revert PythErrors.PriceFeedNotFoundWithinRange();
                }
            }
        }
    }

    function validateTwapPriceInfo(
        PythStructs.TwapPriceInfo memory twapPriceInfoStart,
        PythStructs.TwapPriceInfo memory twapPriceInfoEnd
    ) private pure {
        // First validate each individual price's uniqueness
        if (
            twapPriceInfoStart.prevPublishTime >= twapPriceInfoStart.publishTime
        ) {
            revert PythErrors.InvalidTwapUpdateData();
        }
        if (twapPriceInfoEnd.prevPublishTime >= twapPriceInfoEnd.publishTime) {
            revert PythErrors.InvalidTwapUpdateData();
        }

        // Then validate the relationship between the two data points
        if (twapPriceInfoStart.expo != twapPriceInfoEnd.expo) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }
        if (twapPriceInfoStart.publishSlot > twapPriceInfoEnd.publishSlot) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }
        if (twapPriceInfoStart.publishTime > twapPriceInfoEnd.publishTime) {
            revert PythErrors.InvalidTwapUpdateDataSet();
        }
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    )
        external
        payable
        override
        returns (PythStructs.PriceFeed[] memory priceFeeds)
    {
        (priceFeeds, ) = parsePriceFeedUpdatesInternal(
            updateData,
            priceIds,
            PythInternalStructs.ParseConfig(
                minPublishTime,
                maxPublishTime,
                true,
                false
            )
        );
    }

    function getTotalFee(
        uint totalNumUpdates
    ) private view returns (uint requiredFee) {
        return
            (totalNumUpdates * singleUpdateFeeInWei()) + transactionFeeInWei();
    }

    function findIndexOfPriceId(
        bytes32[] calldata priceIds,
        bytes32 targetPriceId
    ) private pure returns (uint index) {
        uint k = 0;
        for (; k < priceIds.length; k++) {
            if (priceIds[k] == targetPriceId) {
                break;
            }
        }
        return k;
    }

    function fillPriceFeedFromPriceInfo(
        PythStructs.PriceFeed[] memory priceFeeds,
        uint k,
        bytes32 priceId,
        PythInternalStructs.PriceInfo memory info,
        uint publishTime,
        uint64[] memory slots,
        uint64 slot
    ) private pure {
        priceFeeds[k].id = priceId;
        priceFeeds[k].price.price = info.price;
        priceFeeds[k].price.conf = info.conf;
        priceFeeds[k].price.expo = info.expo;
        priceFeeds[k].price.publishTime = publishTime;
        priceFeeds[k].emaPrice.price = info.emaPrice;
        priceFeeds[k].emaPrice.conf = info.emaConf;
        priceFeeds[k].emaPrice.expo = info.expo;
        priceFeeds[k].emaPrice.publishTime = publishTime;
        slots[k] = slot;
    }

    function queryPriceFeed(
        bytes32 id
    ) public view override returns (PythStructs.PriceFeed memory priceFeed) {
        // Look up the latest price info for the given ID
        PythInternalStructs.PriceInfo memory info = latestPriceInfo(id);
        if (info.publishTime == 0) revert PythErrors.PriceFeedNotFound();

        priceFeed.id = id;
        priceFeed.price.price = info.price;
        priceFeed.price.conf = info.conf;
        priceFeed.price.expo = info.expo;
        priceFeed.price.publishTime = uint(info.publishTime);

        priceFeed.emaPrice.price = info.emaPrice;
        priceFeed.emaPrice.conf = info.emaConf;
        priceFeed.emaPrice.expo = info.expo;
        priceFeed.emaPrice.publishTime = uint(info.publishTime);
    }

    function priceFeedExists(bytes32 id) public view override returns (bool) {
        return (latestPriceInfoPublishTime(id) != 0);
    }

    function getValidTimePeriod() public view override returns (uint) {
        return validTimePeriodSeconds();
    }

    function version() public pure returns (string memory) {
        return "1.4.4-alpha.6";
    }

    /// @notice Calculates TWAP from two price points
    /// @dev The calculation is done by taking the difference of cumulative values and dividing by the time difference
    /// @param priceId The price feed ID
    /// @param twapPriceInfoStart The starting price point
    /// @param twapPriceInfoEnd The ending price point
    /// @return twapPriceFeed The calculated TWAP price feed
    function calculateTwap(
        bytes32 priceId,
        PythStructs.TwapPriceInfo memory twapPriceInfoStart,
        PythStructs.TwapPriceInfo memory twapPriceInfoEnd
    ) private pure returns (PythStructs.TwapPriceFeed memory twapPriceFeed) {
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

        // Calculate time-weighted average price (TWAP) and confidence by dividing
        // the difference in cumulative values by the number of slots between data points
        int128 twapPrice = priceDiff / int128(uint128(slotDiff));
        uint128 twapConf = confDiff / uint128(slotDiff);

        // The conversion from int128 to int64 is safe because:
        // 1. Individual prices fit within int64 by protocol design
        // 2. TWAP is essentially an average price over time (cumulativePrice₂-cumulativePrice₁)/slotDiff
        // 3. This average must be within the range of individual prices that went into the calculation
        // We use int128 only as an intermediate type to safely handle cumulative sums
        twapPriceFeed.twap.price = int64(twapPrice);
        twapPriceFeed.twap.conf = uint64(twapConf);
        twapPriceFeed.twap.expo = twapPriceInfoStart.expo;
        twapPriceFeed.twap.publishTime = twapPriceInfoEnd.publishTime;

        // Calculate downSlotsRatio as a value between 0 and 1,000,000
        // 0 means no slots were missed, 1,000,000 means all slots were missed
        uint64 totalDownSlots = twapPriceInfoEnd.numDownSlots -
            twapPriceInfoStart.numDownSlots;
        uint64 downSlotsRatio = (totalDownSlots * 1_000_000) / slotDiff;

        // Safely downcast to uint32 (sufficient for value range 0-1,000,000)
        twapPriceFeed.downSlotsRatio = uint32(downSlotsRatio);

        return twapPriceFeed;
    }
}

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
        return 255 * singleUpdateFeeInWei() * updateDataSize;
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

    function parsePriceFeedUpdatesInternal(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        PythInternalStructs.ParseConfig memory config
    ) internal returns (PythStructs.PriceFeed[] memory priceFeeds) {
        {
            uint requiredFee = getUpdateFee(updateData);
            if (msg.value < requiredFee) revert PythErrors.InsufficientFee();
        }
        unchecked {
            priceFeeds = new PythStructs.PriceFeed[](priceIds.length);
            for (uint i = 0; i < updateData.length; i++) {
                if (
                    updateData[i].length > 4 &&
                    UnsafeCalldataBytesLib.toUint32(updateData[i], 0) ==
                    ACCUMULATOR_MAGIC
                ) {
                    uint offset;
                    {
                        UpdateType updateType;
                        (
                            offset,
                            updateType
                        ) = extractUpdateTypeFromAccumulatorHeader(
                            updateData[i]
                        );

                        if (updateType != UpdateType.WormholeMerkle) {
                            revert PythErrors.InvalidUpdateData();
                        }
                    }

                    bytes20 digest;
                    uint8 numUpdates;
                    bytes calldata encoded;
                    (
                        offset,
                        digest,
                        numUpdates,
                        encoded
                    ) = extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedFromAccumulatorUpdate(
                        updateData[i],
                        offset
                    );

                    for (uint j = 0; j < numUpdates; j++) {
                        PythInternalStructs.PriceInfo memory priceInfo;
                        bytes32 priceId;
                        uint64 prevPublishTime;
                        (
                            offset,
                            priceInfo,
                            priceId,
                            prevPublishTime
                        ) = extractPriceInfoFromMerkleProof(
                            digest,
                            encoded,
                            offset
                        );
                        updateLatestPriceIfNecessary(priceId, priceInfo);
                        {
                            // check whether caller requested for this data
                            uint k = findIndexOfPriceId(priceIds, priceId);

                            // If priceFeed[k].id != 0 then it means that there was a valid
                            // update for priceIds[k] and we don't need to process this one.
                            if (k == priceIds.length || priceFeeds[k].id != 0) {
                                continue;
                            }

                            uint publishTime = uint(priceInfo.publishTime);
                            // Check the publish time of the price is within the given range
                            // and only fill the priceFeedsInfo if it is.
                            // If is not, default id value of 0 will still be set and
                            // this will allow other updates for this price id to be processed.
                            if (
                                publishTime >= config.minPublishTime &&
                                publishTime <= config.maxPublishTime &&
                                (!config.checkUniqueness ||
                                    config.minPublishTime > prevPublishTime)
                            ) {
                                fillPriceFeedFromPriceInfo(
                                    priceFeeds,
                                    k,
                                    priceId,
                                    priceInfo,
                                    publishTime
                                );
                            }
                        }
                    }
                    if (offset != encoded.length)
                        revert PythErrors.InvalidUpdateData();
                } else {
                    revert PythErrors.InvalidUpdateData();
                }
            }

            for (uint k = 0; k < priceIds.length; k++) {
                if (priceFeeds[k].id == 0) {
                    revert PythErrors.PriceFeedNotFoundWithinRange();
                }
            }
        }
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
        return
            parsePriceFeedUpdatesInternal(
                updateData,
                priceIds,
                PythInternalStructs.ParseConfig(
                    minPublishTime,
                    maxPublishTime,
                    false
                )
            );
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
        return
            parsePriceFeedUpdatesInternal(
                updateData,
                priceIds,
                PythInternalStructs.ParseConfig(
                    minPublishTime,
                    maxPublishTime,
                    true
                )
            );
    }

    function getTotalFee(
        uint totalNumUpdates
    ) private view returns (uint requiredFee) {
        return totalNumUpdates * singleUpdateFeeInWei();
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
        uint publishTime
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
        return "1.4.3";
    }
}

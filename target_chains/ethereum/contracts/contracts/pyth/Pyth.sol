// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/UnsafeBytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythInternalStructs.sol";

abstract contract Pyth is PythGetters, PythSetters, AbstractPyth {
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

    function updatePriceBatchFromVm(bytes calldata encodedVm) private {
        parseAndProcessBatchPriceAttestation(
            parseAndVerifyBatchAttestationVM(encodedVm)
        );
    }

    function updatePriceFeeds(
        bytes[] calldata updateData
    ) public payable override {
        uint requiredFee = getUpdateFee(updateData);
        if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

        for (uint i = 0; i < updateData.length; ) {
            updatePriceBatchFromVm(updateData[i]);

            unchecked {
                i++;
            }
        }
    }

    /// This method is deprecated, please use the `getUpdateFee(bytes[])` instead.
    function getUpdateFee(
        uint updateDataSize
    ) public view returns (uint feeAmount) {
        return singleUpdateFeeInWei() * updateDataSize;
    }

    function getUpdateFee(
        bytes[] calldata updateData
    ) public view override returns (uint feeAmount) {
        return singleUpdateFeeInWei() * updateData.length;
    }

    function requirePriceFeeds(
        bytes32[] memory priceIds
    ) public payable override returns (bytes32) {
        bytes32 requestId = keccak256(abi.encode(tx.origin, priceIds));
        address payable payer = getPendingRequest(requestId);

        if (payer != address(0x0)) {
            console.log(payer);
            console.log(address(this));
            console.log(address(this).balance);
            // TODO: transfer?
            bool success = payer.send(msg.value);
            console.log(success);
            clearPendingRequest(requestId);
        } else {
            revert PythErrors.RequirePriceFeeds(priceIds);
        }

        return requestId;
    }

    function updatePriceFeedsOnBehalfOf(
        address requester,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData
    ) public payable override returns (bytes32) {
        // TODO: does this need to be more differentiated??
        bytes32 requestId = keccak256(abi.encode(requester, priceIds));

        updatePriceFeeds(updateData);

        // TODO: check that update includes all of priceIds

        setPendingRequest(requestId, payable(msg.sender));

        return requestId;
    }

    function verifyPythVM(
        IWormhole.VM memory vm
    ) private view returns (bool valid) {
        return isValidDataSource(vm.emitterChainId, vm.emitterAddress);
    }

    function parseAndProcessBatchPriceAttestation(
        IWormhole.VM memory vm
    ) internal {
        // Most of the math operations below are simple additions.
        // In the places that there is more complex operation there is
        // a comment explaining why it is safe. Also, byteslib
        // operations have proper require.
        unchecked {
            bytes memory encoded = vm.payload;

            (
                uint index,
                uint nAttestations,
                uint attestationSize
            ) = parseBatchAttestationHeader(encoded);

            // Deserialize each attestation
            for (uint j = 0; j < nAttestations; j++) {
                (
                    PythInternalStructs.PriceInfo memory info,
                    bytes32 priceId
                ) = parseSingleAttestationFromBatch(
                        encoded,
                        index,
                        attestationSize
                    );

                // Respect specified attestation size for forward-compat
                index += attestationSize;

                // Store the attestation
                uint64 latestPublishTime = latestPriceInfoPublishTime(priceId);

                if (info.publishTime > latestPublishTime) {
                    setLatestPriceInfo(priceId, info);
                    emit PriceFeedUpdate(
                        priceId,
                        info.publishTime,
                        info.price,
                        info.conf
                    );
                }
            }

            emit BatchPriceFeedUpdate(vm.emitterChainId, vm.sequence);
        }
    }

    function parseSingleAttestationFromBatch(
        bytes memory encoded,
        uint index,
        uint attestationSize
    )
        internal
        pure
        returns (PythInternalStructs.PriceInfo memory info, bytes32 priceId)
    {
        unchecked {
            // NOTE: We don't advance the global index immediately.
            // attestationIndex is an attestation-local offset used
            // for readability and easier debugging.
            uint attestationIndex = 0;

            // Unused bytes32 product id
            attestationIndex += 32;

            priceId = UnsafeBytesLib.toBytes32(
                encoded,
                index + attestationIndex
            );
            attestationIndex += 32;

            info.price = int64(
                UnsafeBytesLib.toUint64(encoded, index + attestationIndex)
            );
            attestationIndex += 8;

            info.conf = UnsafeBytesLib.toUint64(
                encoded,
                index + attestationIndex
            );
            attestationIndex += 8;

            info.expo = int32(
                UnsafeBytesLib.toUint32(encoded, index + attestationIndex)
            );
            attestationIndex += 4;

            info.emaPrice = int64(
                UnsafeBytesLib.toUint64(encoded, index + attestationIndex)
            );
            attestationIndex += 8;

            info.emaConf = UnsafeBytesLib.toUint64(
                encoded,
                index + attestationIndex
            );
            attestationIndex += 8;

            {
                // Status is an enum (encoded as uint8) with the following values:
                // 0 = UNKNOWN: The price feed is not currently updating for an unknown reason.
                // 1 = TRADING: The price feed is updating as expected.
                // 2 = HALTED: The price feed is not currently updating because trading in the product has been halted.
                // 3 = AUCTION: The price feed is not currently updating because an auction is setting the price.
                uint8 status = UnsafeBytesLib.toUint8(
                    encoded,
                    index + attestationIndex
                );
                attestationIndex += 1;

                // Unused uint32 numPublishers
                attestationIndex += 4;

                // Unused uint32 numPublishers
                attestationIndex += 4;

                // Unused uint64 attestationTime
                attestationIndex += 8;

                info.publishTime = UnsafeBytesLib.toUint64(
                    encoded,
                    index + attestationIndex
                );
                attestationIndex += 8;

                if (status == 1) {
                    // status == TRADING
                    attestationIndex += 24;
                } else {
                    // If status is not trading then the latest available price is
                    // the previous price info that are passed here.

                    // Previous publish time
                    info.publishTime = UnsafeBytesLib.toUint64(
                        encoded,
                        index + attestationIndex
                    );
                    attestationIndex += 8;

                    // Previous price
                    info.price = int64(
                        UnsafeBytesLib.toUint64(
                            encoded,
                            index + attestationIndex
                        )
                    );
                    attestationIndex += 8;

                    // Previous confidence
                    info.conf = UnsafeBytesLib.toUint64(
                        encoded,
                        index + attestationIndex
                    );
                    attestationIndex += 8;
                }
            }

            if (attestationIndex > attestationSize)
                revert PythErrors.InvalidUpdateData();
        }
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

    function parseBatchAttestationHeader(
        bytes memory encoded
    )
        internal
        pure
        returns (uint index, uint nAttestations, uint attestationSize)
    {
        unchecked {
            index = 0;

            // Check header
            {
                uint32 magic = UnsafeBytesLib.toUint32(encoded, index);
                index += 4;
                if (magic != 0x50325748) revert PythErrors.InvalidUpdateData();

                uint16 versionMajor = UnsafeBytesLib.toUint16(encoded, index);
                index += 2;
                if (versionMajor != 3) revert PythErrors.InvalidUpdateData();

                // This value is only used as the check below which currently
                // never reverts
                // uint16 versionMinor = UnsafeBytesLib.toUint16(encoded, index);
                index += 2;

                // This check is always false as versionMinor is 0, so it is commented.
                // in the future that the minor version increases this will have effect.
                // if(versionMinor < 0) revert InvalidUpdateData();

                uint16 hdrSize = UnsafeBytesLib.toUint16(encoded, index);
                index += 2;

                // NOTE(2022-04-19): Currently, only payloadId comes after
                // hdrSize. Future extra header fields must be read using a
                // separate offset to respect hdrSize, i.e.:
                //
                // uint hdrIndex = 0;
                // bpa.header.payloadId = UnsafeBytesLib.toUint8(encoded, index + hdrIndex);
                // hdrIndex += 1;
                //
                // bpa.header.someNewField = UnsafeBytesLib.toUint32(encoded, index + hdrIndex);
                // hdrIndex += 4;
                //
                // // Skip remaining unknown header bytes
                // index += bpa.header.hdrSize;

                uint8 payloadId = UnsafeBytesLib.toUint8(encoded, index);

                // Skip remaining unknown header bytes
                index += hdrSize;

                // Payload ID of 2 required for batch headerBa
                if (payloadId != 2) revert PythErrors.InvalidUpdateData();
            }

            // Parse the number of attestations
            nAttestations = UnsafeBytesLib.toUint16(encoded, index);
            index += 2;

            // Parse the attestation size
            attestationSize = UnsafeBytesLib.toUint16(encoded, index);
            index += 2;

            // Given the message is valid the arithmetic below should not overflow, and
            // even if it overflows then the require would fail.
            if (encoded.length != (index + (attestationSize * nAttestations)))
                revert PythErrors.InvalidUpdateData();
        }
    }

    function parseAndVerifyBatchAttestationVM(
        bytes calldata encodedVm
    ) internal view returns (IWormhole.VM memory vm) {
        {
            bool valid;
            (vm, valid, ) = wormhole().parseAndVerifyVM(encodedVm);
            if (!valid) revert PythErrors.InvalidWormholeVaa();
        }

        if (!verifyPythVM(vm)) revert PythErrors.InvalidUpdateDataSource();
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
        unchecked {
            {
                uint requiredFee = getUpdateFee(updateData);
                if (msg.value < requiredFee)
                    revert PythErrors.InsufficientFee();
            }

            priceFeeds = new PythStructs.PriceFeed[](priceIds.length);

            for (uint i = 0; i < updateData.length; i++) {
                bytes memory encoded;

                {
                    IWormhole.VM memory vm = parseAndVerifyBatchAttestationVM(
                        updateData[i]
                    );
                    encoded = vm.payload;
                }

                (
                    uint index,
                    uint nAttestations,
                    uint attestationSize
                ) = parseBatchAttestationHeader(encoded);

                // Deserialize each attestation
                for (uint j = 0; j < nAttestations; j++) {
                    // NOTE: We don't advance the global index immediately.
                    // attestationIndex is an attestation-local offset used
                    // for readability and easier debugging.
                    uint attestationIndex = 0;

                    // Unused bytes32 product id
                    attestationIndex += 32;

                    bytes32 priceId = UnsafeBytesLib.toBytes32(
                        encoded,
                        index + attestationIndex
                    );

                    // Check whether the caller requested for this data.
                    uint k = 0;
                    for (; k < priceIds.length; k++) {
                        if (priceIds[k] == priceId) {
                            break;
                        }
                    }

                    // If priceFeed[k].id != 0 then it means that there was a valid
                    // update for priceIds[k] and we don't need to process this one.
                    if (k == priceIds.length || priceFeeds[k].id != 0) {
                        index += attestationSize;
                        continue;
                    }

                    (
                        PythInternalStructs.PriceInfo memory info,

                    ) = parseSingleAttestationFromBatch(
                            encoded,
                            index,
                            attestationSize
                        );

                    priceFeeds[k].id = priceId;
                    priceFeeds[k].price.price = info.price;
                    priceFeeds[k].price.conf = info.conf;
                    priceFeeds[k].price.expo = info.expo;
                    priceFeeds[k].price.publishTime = uint(info.publishTime);
                    priceFeeds[k].emaPrice.price = info.emaPrice;
                    priceFeeds[k].emaPrice.conf = info.emaConf;
                    priceFeeds[k].emaPrice.expo = info.expo;
                    priceFeeds[k].emaPrice.publishTime = uint(info.publishTime);

                    // Check the publish time of the price is within the given range
                    // if it is not, then set the id to 0 to indicate that this price id
                    // still does not have a valid price feed. This will allow other updates
                    // for this price id to be processed.
                    if (
                        priceFeeds[k].price.publishTime < minPublishTime ||
                        priceFeeds[k].price.publishTime > maxPublishTime
                    ) {
                        priceFeeds[k].id = 0;
                    }

                    index += attestationSize;
                }
            }

            for (uint k = 0; k < priceIds.length; k++) {
                if (priceFeeds[k].id == 0) {
                    revert PythErrors.PriceFeedNotFoundWithinRange();
                }
            }
        }
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
        return "1.2.0";
    }
}

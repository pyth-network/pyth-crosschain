// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/UnsafeBytesLib.sol";
import "../libraries/external/UnsafeCalldataBytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythInternalStructs.sol";

import "../libraries/MerkleTree.sol";

abstract contract PythAccumulator is PythGetters, PythSetters, AbstractPyth {
    uint32 constant ACCUMULATOR_MAGIC = 0x504e4155; // Stands for PNAU (Pyth Network Accumulator Update)
    uint32 constant ACCUMULATOR_WORMHOLE_MAGIC = 0x41555756; // Stands for AUWV (Accumulator Update Wormhole Verficiation)
    uint8 constant MINIMUM_ALLOWED_MINOR_VERSION = 0;
    uint8 constant MAJOR_VERSION = 1;

    enum UpdateType {
        WormholeMerkle
    }

    enum MessageType {
        PriceFeed,
        TwapPriceFeed
    }

    // This method is also used by batch attestation but moved here
    // as the batch attestation will deprecate soon.
    function parseAndVerifyPythVM(
        bytes calldata encodedVm
    ) internal view returns (IWormhole.VM memory vm) {
        {
            bool valid;
            (vm, valid, ) = wormhole().parseAndVerifyVM(encodedVm);
            if (!valid) revert PythErrors.InvalidWormholeVaa();
        }

        if (!isValidDataSource(vm.emitterChainId, vm.emitterAddress))
            revert PythErrors.InvalidUpdateDataSource();
    }

    function extractUpdateTypeFromAccumulatorHeader(
        bytes calldata accumulatorUpdate
    ) internal pure returns (uint offset, UpdateType updateType) {
        unchecked {
            offset = 0;

            {
                uint32 magic = UnsafeCalldataBytesLib.toUint32(
                    accumulatorUpdate,
                    offset
                );
                offset += 4;

                if (magic != ACCUMULATOR_MAGIC)
                    revert PythErrors.InvalidUpdateData();

                uint8 majorVersion = UnsafeCalldataBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );

                offset += 1;

                if (majorVersion != MAJOR_VERSION)
                    revert PythErrors.InvalidUpdateData();

                uint8 minorVersion = UnsafeCalldataBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );

                offset += 1;

                // Minor versions are forward compatible, so we only check
                // that the minor version is not less than the minimum allowed
                if (minorVersion < MINIMUM_ALLOWED_MINOR_VERSION)
                    revert PythErrors.InvalidUpdateData();

                // This field ensure that we can add headers in the future
                // without breaking the contract (future compatibility)
                uint8 trailingHeaderSize = UnsafeCalldataBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );
                offset += 1;

                // We use another offset for the trailing header and in the end add the
                // offset by trailingHeaderSize to skip the future headers.
                //
                // An example would be like this:
                // uint trailingHeaderOffset = offset
                // uint x = UnsafeBytesLib.ToUint8(accumulatorUpdate, trailingHeaderOffset)
                // trailingHeaderOffset += 1

                offset += trailingHeaderSize;
            }

            updateType = UpdateType(
                UnsafeCalldataBytesLib.toUint8(accumulatorUpdate, offset)
            );

            offset += 1;

            if (accumulatorUpdate.length < offset)
                revert PythErrors.InvalidUpdateData();
        }
    }

    function extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedAndSlotFromAccumulatorUpdate(
        bytes calldata accumulatorUpdate,
        uint encodedOffset
    )
        internal
        view
        returns (
            uint offset,
            bytes20 digest,
            uint8 numUpdates,
            bytes calldata encoded,
            uint64 slot
        )
    {
        unchecked {
            encoded = UnsafeCalldataBytesLib.slice(
                accumulatorUpdate,
                encodedOffset,
                accumulatorUpdate.length - encodedOffset
            );
            offset = 0;

            uint16 whProofSize = UnsafeCalldataBytesLib.toUint16(
                encoded,
                offset
            );
            offset += 2;

            {
                bytes memory encodedPayload;
                {
                    IWormhole.VM memory vm = parseAndVerifyPythVM(
                        UnsafeCalldataBytesLib.slice(
                            encoded,
                            offset,
                            whProofSize
                        )
                    );
                    offset += whProofSize;

                    // TODO: Do we need to emit an update for accumulator update? If so what should we emit?
                    // emit AccumulatorUpdate(vm.chainId, vm.sequence);
                    encodedPayload = vm.payload;
                }

                uint payloadOffset = 0;
                {
                    uint32 magic = UnsafeBytesLib.toUint32(
                        encodedPayload,
                        payloadOffset
                    );
                    payloadOffset += 4;

                    if (magic != ACCUMULATOR_WORMHOLE_MAGIC)
                        revert PythErrors.InvalidUpdateData();

                    UpdateType updateType = UpdateType(
                        UnsafeBytesLib.toUint8(encodedPayload, payloadOffset)
                    );
                    ++payloadOffset;

                    if (updateType != UpdateType.WormholeMerkle)
                        revert PythErrors.InvalidUpdateData();

                    slot = UnsafeBytesLib.toUint64(
                        encodedPayload,
                        payloadOffset
                    );
                    payloadOffset += 8;

                    // This field is not used
                    // uint32 ringSize = UnsafeBytesLib.toUint32(encodedPayload, payloadoffset);
                    payloadOffset += 4;

                    digest = bytes20(
                        UnsafeBytesLib.toAddress(encodedPayload, payloadOffset)
                    );
                    payloadOffset += 20;

                    // We don't check equality to enable future compatibility.
                    if (payloadOffset > encodedPayload.length)
                        revert PythErrors.InvalidUpdateData();
                }
            }

            numUpdates = UnsafeCalldataBytesLib.toUint8(encoded, offset);
            offset += 1;
        }
    }

    function parseWormholeMerkleHeaderNumUpdates(
        bytes calldata wormholeMerkleUpdate,
        uint offset
    ) internal pure returns (uint8 numUpdates) {
        uint16 whProofSize = UnsafeCalldataBytesLib.toUint16(
            wormholeMerkleUpdate,
            offset
        );
        offset += 2;
        offset += whProofSize;
        numUpdates = UnsafeCalldataBytesLib.toUint8(
            wormholeMerkleUpdate,
            offset
        );
    }

    function extractPriceInfoFromMerkleProof(
        bytes20 digest,
        bytes calldata encoded,
        uint offset
    )
        internal
        pure
        returns (
            uint endOffset,
            PythInternalStructs.PriceInfo memory priceInfo,
            bytes32 priceId,
            uint64 prevPublishTime
        )
    {
        bytes calldata encodedMessage;
        MessageType messageType;
        (
            encodedMessage,
            messageType,
            endOffset
        ) = extractAndValidateEncodedMessage(encoded, offset, digest);

        if (messageType == MessageType.PriceFeed) {
            (priceInfo, priceId, prevPublishTime) = parsePriceFeedMessage(
                encodedMessage,
                1
            );
        } else revert PythErrors.InvalidUpdateData();

        return (endOffset, priceInfo, priceId, prevPublishTime);
    }

    function extractTwapPriceInfoFromMerkleProof(
        bytes20 digest,
        bytes calldata encoded,
        uint offset
    )
        internal
        pure
        returns (
            uint endOffset,
            PythStructs.TwapPriceInfo memory twapPriceInfo,
            bytes32 priceId
        )
    {
        bytes calldata encodedMessage;
        MessageType messageType;
        (
            encodedMessage,
            messageType,
            endOffset
        ) = extractAndValidateEncodedMessage(encoded, offset, digest);

        if (messageType == MessageType.TwapPriceFeed) {
            (twapPriceInfo, priceId) = parseTwapPriceFeedMessage(
                encodedMessage,
                1
            );
        } else revert PythErrors.InvalidUpdateData();

        return (endOffset, twapPriceInfo, priceId);
    }

    function extractAndValidateEncodedMessage(
        bytes calldata encoded,
        uint offset,
        bytes20 digest
    )
        private
        pure
        returns (
            bytes calldata encodedMessage,
            MessageType messageType,
            uint endOffset
        )
    {
        uint16 messageSize = UnsafeCalldataBytesLib.toUint16(encoded, offset);
        offset += 2;

        encodedMessage = UnsafeCalldataBytesLib.slice(
            encoded,
            offset,
            messageSize
        );
        offset += messageSize;

        bool valid;
        (valid, endOffset) = MerkleTree.isProofValid(
            encoded,
            offset,
            digest,
            encodedMessage
        );
        if (!valid) {
            revert PythErrors.InvalidUpdateData();
        }

        messageType = MessageType(
            UnsafeCalldataBytesLib.toUint8(encodedMessage, 0)
        );
        if (
            messageType != MessageType.PriceFeed &&
            messageType != MessageType.TwapPriceFeed
        ) {
            revert PythErrors.InvalidUpdateData();
        }
        return (encodedMessage, messageType, endOffset);
    }

    function parsePriceFeedMessage(
        bytes calldata encodedPriceFeed,
        uint offset
    )
        private
        pure
        returns (
            PythInternalStructs.PriceInfo memory priceInfo,
            bytes32 priceId,
            uint64 prevPublishTime
        )
    {
        unchecked {
            priceId = UnsafeCalldataBytesLib.toBytes32(
                encodedPriceFeed,
                offset
            );
            offset += 32;

            priceInfo.price = int64(
                UnsafeCalldataBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.conf = UnsafeCalldataBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            priceInfo.expo = int32(
                UnsafeCalldataBytesLib.toUint32(encodedPriceFeed, offset)
            );
            offset += 4;

            // Publish time is i64 in some environments due to the standard in that
            // environment. This would not cause any problem because since the signed
            // integer is represented in two's complement, the value would be the same
            // in both cases (for a million year at least)
            priceInfo.publishTime = UnsafeCalldataBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            // We do not store this field because it is not used on the latest feed queries.
            prevPublishTime = UnsafeBytesLib.toUint64(encodedPriceFeed, offset);
            offset += 8;

            priceInfo.emaPrice = int64(
                UnsafeCalldataBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.emaConf = UnsafeCalldataBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            if (offset > encodedPriceFeed.length)
                revert PythErrors.InvalidUpdateData();
        }
    }

    function parseTwapPriceFeedMessage(
        bytes calldata encodedTwapPriceFeed,
        uint offset
    )
        private
        pure
        returns (
            PythStructs.TwapPriceInfo memory twapPriceInfo,
            bytes32 priceId
        )
    {
        unchecked {
            priceId = UnsafeCalldataBytesLib.toBytes32(
                encodedTwapPriceFeed,
                offset
            );
            offset += 32;

            twapPriceInfo.cumulativePrice = int128(
                UnsafeCalldataBytesLib.toUint128(encodedTwapPriceFeed, offset)
            );
            offset += 16;

            twapPriceInfo.cumulativeConf = UnsafeCalldataBytesLib.toUint128(
                encodedTwapPriceFeed,
                offset
            );
            offset += 16;

            twapPriceInfo.numDownSlots = UnsafeCalldataBytesLib.toUint64(
                encodedTwapPriceFeed,
                offset
            );
            offset += 8;

            twapPriceInfo.publishSlot = UnsafeCalldataBytesLib.toUint64(
                encodedTwapPriceFeed,
                offset
            );
            offset += 8;

            twapPriceInfo.publishTime = UnsafeCalldataBytesLib.toUint64(
                encodedTwapPriceFeed,
                offset
            );
            offset += 8;

            twapPriceInfo.prevPublishTime = UnsafeCalldataBytesLib.toUint64(
                encodedTwapPriceFeed,
                offset
            );
            offset += 8;

            twapPriceInfo.expo = int32(
                UnsafeCalldataBytesLib.toUint32(encodedTwapPriceFeed, offset)
            );
            offset += 4;

            if (offset > encodedTwapPriceFeed.length)
                revert PythErrors.InvalidUpdateData();
        }
    }

    function updatePriceInfosFromAccumulatorUpdate(
        bytes calldata accumulatorUpdate
    ) internal returns (uint8 numUpdates) {
        (
            uint encodedOffset,
            UpdateType updateType
        ) = extractUpdateTypeFromAccumulatorHeader(accumulatorUpdate);

        if (updateType != UpdateType.WormholeMerkle) {
            revert PythErrors.InvalidUpdateData();
        }

        uint offset;
        bytes20 digest;
        bytes calldata encoded;
        uint64 slot;
        (
            offset,
            digest,
            numUpdates,
            encoded,
            slot
        ) = extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedAndSlotFromAccumulatorUpdate(
            accumulatorUpdate,
            encodedOffset
        );

        unchecked {
            for (uint i = 0; i < numUpdates; i++) {
                PythInternalStructs.PriceInfo memory priceInfo;
                bytes32 priceId;
                uint64 prevPublishTime;
                (
                    offset,
                    priceInfo,
                    priceId,
                    prevPublishTime
                ) = extractPriceInfoFromMerkleProof(digest, encoded, offset);
                updateLatestPriceIfNecessary(priceId, priceInfo);
            }
        }
        if (offset != encoded.length) revert PythErrors.InvalidUpdateData();
    }
}

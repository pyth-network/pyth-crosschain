// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/UnsafeBytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythInternalStructs.sol";

import "../libraries/MerkleTree.sol";

import "forge-std/console.sol";

abstract contract PythAccumulator is PythGetters, PythSetters, AbstractPyth {
    uint32 constant ACCUMULATOR_MAGIC = 0x504e4155; // Stands for PNAU (Pyth Network Accumulator Update)
    uint32 constant ACCUMULATOR_WORMHOLE_MAGIC = 0x41555756; // Stands for AUWV (Accumulator Update Wormhole Verficiation)
    uint8 constant MINIMUM_ALLOWED_MINOR_VERSION = 0;
    uint8 constant MAJOR_VERSION = 1;

    enum UpdateType {
        WormholeMerkle
    }

    enum MessageType {
        PriceFeed
    }

    // This method is also used by batch attestation but moved here
    // as the batch attestation will deprecate soon.
    function parseAndVerifyPythVM(
        bytes memory encodedVm
    ) internal view returns (IWormhole.VM memory vm) {
        {
            bool valid;
            (vm, valid, ) = wormhole().parseAndVerifyVM(encodedVm);
            if (!valid) revert PythErrors.InvalidWormholeVaa();
        }

        if (!isValidDataSource(vm.emitterChainId, vm.emitterAddress))
            revert PythErrors.InvalidUpdateDataSource();
    }

    function parseAccumulatorUpdateHeader(
        bytes memory accumulatorUpdate
    ) internal pure returns (uint offset) {
        unchecked {
            offset = 0;

            {
                uint32 magic = UnsafeBytesLib.toUint32(
                    accumulatorUpdate,
                    offset
                );
                offset += 4;

                if (magic != ACCUMULATOR_MAGIC)
                    revert PythErrors.InvalidUpdateData();

                uint8 majorVersion = UnsafeBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );
                offset += 1;

                if (majorVersion != MAJOR_VERSION)
                    revert PythErrors.InvalidUpdateData();

                uint8 minorVersion = UnsafeBytesLib.toUint8(
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
                uint8 trailingHeaderSize = UnsafeBytesLib.toUint8(
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

            UpdateType updateType = UpdateType(
                UnsafeBytesLib.toUint8(accumulatorUpdate, offset)
            );
            offset += 1;

            if (accumulatorUpdate.length < offset)
                revert PythErrors.InvalidUpdateData();

            if (updateType != UpdateType.WormholeMerkle) {
                revert PythErrors.InvalidUpdateData();
            }
        }
    }

    function parsePricesUsingAccumulator(
        bytes memory accumulatorUpdate
    )
        internal
        view
        returns (
            PythInternalStructs.PriceInfo[] memory priceInfos,
            bytes32[] memory priceIds
        )
    {
        uint offset = parseAccumulatorUpdateHeader(accumulatorUpdate);
        (priceInfos, priceIds) = parsePricesUsingWormholeMerkle(
            UnsafeBytesLib.slice(
                accumulatorUpdate,
                offset,
                accumulatorUpdate.length - offset
            )
        );
    }

    function updatePricesUsingAccumulator(
        bytes calldata accumulatorUpdate
    ) internal {
        uint offset = parseAccumulatorUpdateHeader(accumulatorUpdate);
        console.log("header offset: %d", offset);
        updatePricesUsingWormholeMerkle(
            UnsafeBytesLib.slice(
                accumulatorUpdate,
                offset,
                accumulatorUpdate.length - offset
            )
        );
    }

    function parsePricesUsingWormholeMerkle(
        bytes memory encoded
    )
        internal
        view
        returns (
            PythInternalStructs.PriceInfo[] memory priceInfos,
            bytes32[] memory priceIds
        )
    {
        unchecked {
            uint offset = 0;

            uint16 whProofSize = UnsafeBytesLib.toUint16(encoded, offset);
            offset += 2;

            bytes20 digest;

            {
                IWormhole.VM memory vm = parseAndVerifyPythVM(
                    UnsafeBytesLib.slice(encoded, offset, whProofSize)
                );
                offset += whProofSize;

                // TODO: Do we need to emit an update for accumulator update? If so what should we emit?
                // emit AccumulatorUpdate(vm.chainId, vm.sequence);

                bytes memory encodedPayload = vm.payload;
                uint payloadoffset = 0;

                {
                    uint32 magic = UnsafeBytesLib.toUint32(
                        encodedPayload,
                        payloadoffset
                    );
                    payloadoffset += 4;

                    if (magic != ACCUMULATOR_WORMHOLE_MAGIC)
                        revert PythErrors.InvalidUpdateData();

                    UpdateType updateType = UpdateType(
                        UnsafeBytesLib.toUint8(encodedPayload, payloadoffset)
                    );
                    payloadoffset += 1;

                    if (updateType != UpdateType.WormholeMerkle)
                        revert PythErrors.InvalidUpdateData();

                    // This field is not used
                    // uint64 slot = UnsafeBytesLib.toUint64(encodedPayload, payloadoffset);
                    payloadoffset += 8;

                    // This field is not used
                    // uint32 ringSize = UnsafeBytesLib.toUint32(encodedPayload, payloadoffset);
                    payloadoffset += 4;

                    digest = bytes20(
                        UnsafeBytesLib.toAddress(encodedPayload, payloadoffset)
                    );
                    payloadoffset += 20;

                    // We don't check equality to enable future compatibility.
                    if (payloadoffset > encodedPayload.length)
                        revert PythErrors.InvalidUpdateData();
                }
            }

            uint8 numUpdates = UnsafeBytesLib.toUint8(encoded, offset);
            offset += 1;

            priceInfos = new PythInternalStructs.PriceInfo[](numUpdates);
            priceIds = new bytes32[](numUpdates);
            for (uint i = 0; i < numUpdates; i++) {
                (
                    offset,
                    priceInfos[i],
                    priceIds[i]
                ) = verifyAndParsePriceFeedFromMerkleProof(
                    digest,
                    encoded,
                    offset
                );
            }

            if (offset != encoded.length) revert PythErrors.InvalidUpdateData();
        }
    }

    function updatePricesUsingWormholeMerkle(bytes memory encoded) private {
        unchecked {
            uint offset = 0;

            uint16 whProofSize = UnsafeBytesLib.toUint16(encoded, offset);
            offset += 2;

            bytes20 digest;

            {
                IWormhole.VM memory vm = parseAndVerifyPythVM(
                    UnsafeBytesLib.slice(encoded, offset, whProofSize)
                );
                offset += whProofSize;

                // TODO: Do we need to emit an update for accumulator update? If so what should we emit?
                // emit AccumulatorUpdate(vm.chainId, vm.sequence);

                bytes memory encodedPayload = vm.payload;
                uint payloadoffset = 0;

                {
                    uint32 magic = UnsafeBytesLib.toUint32(
                        encodedPayload,
                        payloadoffset
                    );
                    payloadoffset += 4;

                    if (magic != ACCUMULATOR_WORMHOLE_MAGIC)
                        revert PythErrors.InvalidUpdateData();

                    UpdateType updateType = UpdateType(
                        UnsafeBytesLib.toUint8(encodedPayload, payloadoffset)
                    );
                    payloadoffset += 1;

                    if (updateType != UpdateType.WormholeMerkle)
                        revert PythErrors.InvalidUpdateData();

                    // This field is not used
                    // uint64 slot = UnsafeBytesLib.toUint64(encodedPayload, payloadoffset);
                    payloadoffset += 8;

                    // This field is not used
                    // uint32 ringSize = UnsafeBytesLib.toUint32(encodedPayload, payloadoffset);
                    payloadoffset += 4;

                    digest = bytes20(
                        UnsafeBytesLib.toAddress(encodedPayload, payloadoffset)
                    );
                    payloadoffset += 20;

                    // We don't check equality to enable future compatibility.
                    if (payloadoffset > encodedPayload.length)
                        revert PythErrors.InvalidUpdateData();
                }
            }

            uint8 numUpdates = UnsafeBytesLib.toUint8(encoded, offset);
            offset += 1;

            console.log("numUpdates: %d", numUpdates);
            for (uint i = 0; i < numUpdates; i++) {
                offset = verifyAndUpdatePriceFeedFromMerkleProof(
                    digest,
                    encoded,
                    offset
                );
            }

            if (offset != encoded.length) revert PythErrors.InvalidUpdateData();
        }
    }

    function verifyAndParsePriceFeedFromMerkleProof(
        bytes20 digest,
        bytes memory encoded,
        uint offset
    )
        private
        pure
        returns (
            uint endOffset,
            PythInternalStructs.PriceInfo memory priceInfo,
            bytes32 priceId
        )
    {
        unchecked {
            uint16 messageSize = UnsafeBytesLib.toUint16(encoded, offset);
            offset += 2;

            bytes memory encodedMessage = UnsafeBytesLib.slice(
                encoded,
                offset,
                messageSize
            );
            offset += messageSize;

            bool valid;
            (valid, offset) = MerkleTree.isProofValid(
                encoded,
                offset,
                digest,
                encodedMessage
            );

            if (!valid) {
                revert PythErrors.InvalidUpdateData();
            }

            (priceInfo, priceId) = verifyAndParsePriceFeedMessage(
                encodedMessage
            );

            return (offset, priceInfo, priceId);
        }
    }

    function verifyAndUpdatePriceFeedFromMerkleProof(
        bytes20 digest,
        bytes memory encoded,
        uint offset
    ) private returns (uint endOffset) {
        unchecked {
            uint16 messageSize = UnsafeBytesLib.toUint16(encoded, offset);
            offset += 2;

            bytes memory encodedMessage = UnsafeBytesLib.slice(
                encoded,
                offset,
                messageSize
            );
            offset += messageSize;

            bool valid;
            (valid, offset) = MerkleTree.isProofValid(
                encoded,
                offset,
                digest,
                encodedMessage
            );

            if (!valid) {
                revert PythErrors.InvalidUpdateData();
            }
            console.log(
                "[verifyAndUpdatePriceFeedFromMerkleProof]: parseAndProcessMessage"
            );

            parseAndProcessMessage(encodedMessage);

            return offset;
        }
    }

    function parsePriceFeedMessage(
        bytes memory encodedPriceFeed
    )
        private
        pure
        returns (
            PythInternalStructs.PriceInfo memory priceInfo,
            bytes32 priceId
        )
    {
        unchecked {
            uint offset = 0;

            priceId = UnsafeBytesLib.toBytes32(encodedPriceFeed, offset);
            offset += 32;

            priceInfo.price = int64(
                UnsafeBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.conf = UnsafeBytesLib.toUint64(encodedPriceFeed, offset);
            offset += 8;

            priceInfo.expo = int32(
                UnsafeBytesLib.toUint32(encodedPriceFeed, offset)
            );
            offset += 4;

            // Publish time is i64 in some environments due to the standard in that
            // environment. This would not cause any problem because since the signed
            // integer is represented in two's complement, the value would be the same
            // in both cases (for a million year at least)
            priceInfo.publishTime = UnsafeBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            // We do not store this field because it is not used on the latest feed queries.
            // uint64 prevPublishTime = UnsafeBytesLib.toUint64(encodedPriceFeed, offset);
            offset += 8;

            priceInfo.emaPrice = int64(
                UnsafeBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.emaConf = UnsafeBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            // We don't check equality to enable future compatibility.
            if (offset > encodedPriceFeed.length)
                revert PythErrors.InvalidUpdateData();
        }
    }

    function verifyAndParsePriceFeedMessage(
        bytes memory encodedMessage
    )
        private
        pure
        returns (PythInternalStructs.PriceInfo memory info, bytes32 priceId)
    {
        unchecked {
            MessageType messageType = MessageType(
                UnsafeBytesLib.toUint8(encodedMessage, 0)
            );
            if (messageType == MessageType.PriceFeed) {
                (info, priceId) = parsePriceFeedMessage(
                    UnsafeBytesLib.slice(
                        encodedMessage,
                        1,
                        encodedMessage.length - 1
                    )
                );
            } else {
                revert PythErrors.InvalidUpdateData();
            }
        }
    }

    function parseAndProcessMessage(bytes memory encodedMessage) private {
        unchecked {
            (
                PythInternalStructs.PriceInfo memory info,
                bytes32 priceId
            ) = verifyAndParsePriceFeedMessage(encodedMessage);

            console.log("[parseAndProcessMessage] parsed info & priceId");
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
    }
}

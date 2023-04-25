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

abstract contract PythAccumulator is PythGetters, PythSetters, AbstractPyth {
    uint32 constant ACCUMULATOR_MAGIC = 0x504e4155; // Stands for PNAU (Pyth Network Accumulator Update)
    uint32 constant ACCUMULATOR_WORMHOLE_MAGIC = 0x41555756; // Stands for AUWV (Accumulator Update Wormhole Verficiation)

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

    function updatePricesUsingAccumulator(
        bytes calldata accumulatorUpdate
    ) internal {
        unchecked {
            uint offset = 0;

            {
                uint32 magic = UnsafeBytesLib.toUint32(
                    accumulatorUpdate,
                    offset
                );
                offset += 4;

                // TODO: It is checked on the caller, do we still need to check it?
                if (magic != ACCUMULATOR_MAGIC)
                    revert PythErrors.InvalidUpdateData();

                uint8 majorVersion = UnsafeBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );
                offset += 1;

                if (majorVersion != 1) revert PythErrors.InvalidUpdateData();

                // never reverts
                // uint8 minorVersion = UnsafeBytesLib.toUint16(encoded, index);
                offset += 1;

                // This check is always false as minorVersion is 0, so it is commented.
                // in the future that the minor version increases this will have effect.
                // if(minorVersion < 0) revert InvalidUpdateData();

                // This field ensure that we can add headers in the future
                // without breaking the contract (future compatibility)
                uint8 trailingHeaderSize = UnsafeBytesLib.toUint8(
                    accumulatorUpdate,
                    offset
                );
                offset += 1;

                // Currently we don't have any trailing header
                offset += trailingHeaderSize;
            }

            UpdateType updateType = UpdateType(
                UnsafeBytesLib.toUint8(accumulatorUpdate, offset)
            );
            offset += 1;

            if (accumulatorUpdate.length < offset)
                revert PythErrors.InvalidUpdateData();

            if (updateType == UpdateType.WormholeMerkle) {
                updatePricesUsingWormholeMerkle(
                    UnsafeBytesLib.slice(
                        accumulatorUpdate,
                        offset,
                        accumulatorUpdate.length - offset
                    )
                );
            } else {
                revert PythErrors.InvalidUpdateData();
            }
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
                    // uint32 storageIndex = UnsafeBytesLib.toUint32(encodedPayload, payloadoffset);
                    payloadoffset += 4;

                    digest = bytes20(
                        UnsafeBytesLib.toAddress(encodedPayload, payloadoffset)
                    );
                    payloadoffset += 20;

                    // TODO: Do we need to be strict about the size of the payload? How it can evolve?
                    if (payloadoffset != encodedPayload.length)
                        revert PythErrors.InvalidUpdateData();
                }
            }

            uint8 numUpdates = UnsafeBytesLib.toUint8(encoded, offset);
            offset += 1;

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
            (valid, offset) = MerkleTree.verify(
                encoded,
                offset,
                digest,
                encodedMessage
            );

            if (!valid) {
                revert PythErrors.InvalidUpdateData();
            }

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

            priceInfo.publishTime = UnsafeBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
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

            // TODO: Do we need to be strict about the size of the payload? How it can evolve?
            if (offset > encodedPriceFeed.length)
                revert PythErrors.InvalidUpdateData();
        }
    }

    function parseAndProcessMessage(bytes memory encodedMessage) private {
        unchecked {
            MessageType messageType = MessageType(
                UnsafeBytesLib.toUint8(encodedMessage, 0)
            );

            if (messageType == MessageType.PriceFeed) {
                (
                    PythInternalStructs.PriceInfo memory info,
                    bytes32 priceId
                ) = parsePriceFeedMessage(
                        UnsafeBytesLib.slice(
                            encodedMessage,
                            1,
                            encodedMessage.length - 1
                        )
                    );

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
            } else {
                revert PythErrors.InvalidUpdateData();
            }
        }
    }
}

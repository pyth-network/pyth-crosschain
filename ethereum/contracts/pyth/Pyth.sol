// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythInternalStructs.sol";

abstract contract Pyth is PythGetters, PythSetters, AbstractPyth {
    using BytesLib for bytes;

    function initialize(
        address wormhole,
        uint16 pyth2WormholeChainId,
        bytes32 pyth2WormholeEmitter
    ) virtual public {
        setWormhole(wormhole);
        setPyth2WormholeChainId(pyth2WormholeChainId);
        setPyth2WormholeEmitter(pyth2WormholeEmitter);
    }

    function updatePriceBatchFromVm(bytes calldata encodedVm) private returns (PythInternalStructs.BatchPriceAttestation memory bpa) {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

        require(valid, reason);
        require(verifyPythVM(vm), "invalid data source chain/emitter ID");

        PythInternalStructs.BatchPriceAttestation memory batch = parseBatchPriceAttestation(vm.payload);

        uint freshPrices = 0;

        for (uint i = 0; i < batch.attestations.length; i++) {
            PythInternalStructs.PriceAttestation memory attestation = batch.attestations[i];

            PythInternalStructs.PriceInfo memory latestPrice = latestPriceInfo(attestation.priceId);

            bool fresh = false;
            if(attestation.attestationTime > latestPrice.attestationTime) {
                freshPrices += 1;
                fresh = true;
                setLatestPriceInfo(attestation.priceId, newPriceInfo(attestation));
            }

            emit PriceFeedUpdate(attestation.priceId, fresh, vm.emitterChainId, vm.sequence, latestPrice.priceFeed.publishTime,
                attestation.publishTime, attestation.price, attestation.conf);
        }

        emit BatchPriceFeedUpdate(vm.emitterChainId, vm.sequence, batch.attestations.length, freshPrices);

        return batch;
    }

    function updatePriceFeeds(bytes[] calldata updateData) public override payable {
        uint requiredFee = getUpdateFee(updateData.length);
        require(msg.value >= requiredFee, "Insufficient paid fee amount");
        payable(msg.sender).transfer(msg.value - requiredFee);
 
        for(uint i = 0; i < updateData.length; i++) {
            updatePriceBatchFromVm(updateData[i]);
        }

        emit UpdatePriceFeeds(msg.sender, updateData.length, requiredFee);
    }

    function getUpdateFee(uint updateDataSize) public override view returns (uint feeAmount) {
        return singleUpdateFeeInWei() * updateDataSize;
    }

    function newPriceInfo(PythInternalStructs.PriceAttestation memory pa) private view returns (PythInternalStructs.PriceInfo memory info) {
        info.attestationTime = pa.attestationTime;
        info.arrivalTime = block.timestamp;
        info.arrivalBlock = block.number;

        info.priceFeed.id = pa.priceId;
        info.priceFeed.price = pa.price;
        info.priceFeed.conf = pa.conf;
        info.priceFeed.expo = pa.expo;
        info.priceFeed.status = PythStructs.PriceStatus(pa.status);
        info.priceFeed.emaPrice = pa.emaPrice;
        info.priceFeed.emaConf = pa.emaConf;
        info.priceFeed.productId = pa.productId;
        info.priceFeed.numPublishers = pa.numPublishers;
        info.priceFeed.maxNumPublishers = pa.maxNumPublishers;
        info.priceFeed.prevConf = pa.prevConf;
        info.priceFeed.prevPublishTime = pa.prevPublishTime;
        info.priceFeed.prevPrice = pa.prevPrice;
        info.priceFeed.publishTime = pa.publishTime;
        return info;
    }

    function verifyPythVM(IWormhole.VM memory vm) private view returns (bool valid) {
        return isValidDataSource(vm.emitterChainId, vm.emitterAddress); 
    }


    function parseBatchPriceAttestation(bytes memory encoded) public pure returns (PythInternalStructs.BatchPriceAttestation memory bpa) {
        uint index = 0;

        // Check header
        bpa.header.magic = encoded.toUint32(index);
        index += 4;
        require(bpa.header.magic == 0x50325748, "invalid magic value");

        bpa.header.versionMajor = encoded.toUint16(index);
        index += 2;
        require(bpa.header.versionMajor == 3, "invalid version major, expected 3");

        bpa.header.versionMinor = encoded.toUint16(index);
        index += 2;
        require(bpa.header.versionMinor >= 0, "invalid version minor, expected 0 or more");

        bpa.header.hdrSize = encoded.toUint16(index);
        index += 2;

        // NOTE(2022-04-19): Currently, only payloadId comes after
        // hdrSize. Future extra header fields must be read using a
        // separate offset to respect hdrSize, i.e.:
        //
        // uint hdrIndex = 0;
        // bpa.header.payloadId = encoded.toUint8(index + hdrIndex);
        // hdrIndex += 1;
        //
        // bpa.header.someNewField = encoded.toUint32(index + hdrIndex);
        // hdrIndex += 4;
        //
        // // Skip remaining unknown header bytes
        // index += bpa.header.hdrSize;

        bpa.header.payloadId = encoded.toUint8(index);

        // Skip remaining unknown header bytes
        index += bpa.header.hdrSize;

        // Payload ID of 2 required for batch headerBa
        require(bpa.header.payloadId == 2, "invalid payload ID, expected 2 for BatchPriceAttestation");

        // Parse the number of attestations
        bpa.nAttestations = encoded.toUint16(index);
        index += 2;

        // Parse the attestation size
        bpa.attestationSize = encoded.toUint16(index);
        index += 2;
        require(encoded.length == (index + (bpa.attestationSize * bpa.nAttestations)), "invalid BatchPriceAttestation size");

        bpa.attestations = new PythInternalStructs.PriceAttestation[](bpa.nAttestations);

        // Deserialize each attestation
        for (uint j=0; j < bpa.nAttestations; j++) {
            // NOTE: We don't advance the global index immediately.
            // attestationIndex is an attestation-local offset used
            // for readability and easier debugging.
            uint attestationIndex = 0;

            // Attestation
            bpa.attestations[j].productId = encoded.toBytes32(index + attestationIndex);
            attestationIndex += 32;

            bpa.attestations[j].priceId = encoded.toBytes32(index + attestationIndex);
            attestationIndex += 32;

            bpa.attestations[j].price = int64(encoded.toUint64(index + attestationIndex));
            attestationIndex += 8;

            bpa.attestations[j].conf = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            bpa.attestations[j].expo = int32(encoded.toUint32(index + attestationIndex));
            attestationIndex += 4;

            bpa.attestations[j].emaPrice = int64(encoded.toUint64(index + attestationIndex));
            attestationIndex += 8;

            bpa.attestations[j].emaConf = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            bpa.attestations[j].status = encoded.toUint8(index + attestationIndex);
            attestationIndex += 1;

            bpa.attestations[j].numPublishers = encoded.toUint32(index + attestationIndex);
            attestationIndex += 4;

            bpa.attestations[j].maxNumPublishers = encoded.toUint32(index + attestationIndex);
            attestationIndex += 4;

            bpa.attestations[j].attestationTime = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            bpa.attestations[j].publishTime = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            bpa.attestations[j].prevPublishTime = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            bpa.attestations[j].prevPrice = int64(encoded.toUint64(index + attestationIndex));
            attestationIndex += 8;

            bpa.attestations[j].prevConf = encoded.toUint64(index + attestationIndex);
            attestationIndex += 8;

            require(attestationIndex <= bpa.attestationSize, "INTERNAL: Consumed more than `attestationSize` bytes");

            // Respect specified attestation size for forward-compat
            index += bpa.attestationSize;
        }
    }

    function queryPriceFeed(bytes32 id) public view override returns (PythStructs.PriceFeed memory priceFeed){
        // Look up the latest price info for the given ID
        PythInternalStructs.PriceInfo memory info = latestPriceInfo(id);
        require(info.priceFeed.id != 0, "no price feed found for the given price id");

        return info.priceFeed;
    }

    function priceFeedExists(bytes32 id) public override view returns (bool) {
        PythInternalStructs.PriceInfo memory info = latestPriceInfo(id);
        return (info.priceFeed.id != 0);
    }

    function getValidTimePeriod() public override view returns (uint) {
        return validTimePeriodSeconds();
    }

    function version() public pure returns (string memory) {
        return "0.1.0";
    }

    function deployCommitHash() public pure returns (string memory) {
        // This is a place holder for the commit hash and will be replaced
        // with the commit hash upon deployment.
        return "__DEPLOY_COMMIT_HASH_PLACEHOLER__";
    }
}

// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythStructs.sol";

contract Pyth is PythGetters, PythSetters {
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

    function updatePriceBatchFromVm(bytes memory encodedVm) public returns (PythStructs.BatchPriceAttestation memory bpa) {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

        require(valid, reason);
        require(verifyPythVM(vm), "invalid emitter");

        PythStructs.BatchPriceAttestation memory batch = parseBatchPriceAttestation(vm.payload);

        for (uint i = 0; i < batch.attestations.length; i++) {
            PythStructs.PriceAttestation memory attestation = batch.attestations[i];

            PythStructs.PriceInfo memory latestPrice = latestPriceInfo(attestation.priceId);

            if(attestation.timestamp > latestPrice.attestationTime) {
                setLatestPriceInfo(attestation.priceId, newPriceInfo(attestation));
            }
        }

        return batch;
    }

    function newPriceInfo(PythStructs.PriceAttestation memory pa) private view returns (PythStructs.PriceInfo memory info) {
        info.attestationTime = pa.timestamp;
        info.arrivalTime = block.timestamp;
        info.arrivalBlock = block.number;
        
        info.priceFeed.id = pa.priceId;
        info.priceFeed.price = pa.price;
        info.priceFeed.conf = pa.confidenceInterval;
        info.priceFeed.status = PythSDK.PriceStatus(pa.status);
        info.priceFeed.expo = pa.exponent;
        info.priceFeed.emaPrice = pa.emaPrice.value;
        info.priceFeed.emaConf = uint64(pa.emaConf.value);
        info.priceFeed.productId = pa.productId;

        // These aren't sent in the wire format yet
        info.priceFeed.numPublishers = 0;
        info.priceFeed.maxNumPublishers = 0;
        return info;
    }

    function verifyPythVM(IWormhole.VM memory vm) private view returns (bool valid) {
        if (vm.emitterChainId != pyth2WormholeChainId()) {
            return false;
        }
        if (vm.emitterAddress != pyth2WormholeEmitter()) {
            return false;
        }
        return true;
    }

    
    function parseBatchPriceAttestation(bytes memory encoded) public pure returns (PythStructs.BatchPriceAttestation memory bpa) {
        uint index = 0;

        // Check header
        bpa.header.magic = encoded.toUint32(index);
        index += 4;
        require(bpa.header.magic == 0x50325748, "invalid magic value");

        bpa.header.version = encoded.toUint16(index);
        index += 2;
        require(bpa.header.version == 2, "invalid version");

        bpa.header.payloadId = encoded.toUint8(index);
        index += 1;
        // Payload ID of 2 required for batch header
        require(bpa.header.payloadId == 2, "invalid payload ID");

        // Parse the number of attestations
        bpa.nAttestations = encoded.toUint16(index);
        index += 2;

        // Parse the attestation size
        bpa.attestationSize = encoded.toUint16(index);
        index += 2;
        require(encoded.length == (index + (bpa.attestationSize * bpa.nAttestations)), "invalid BatchPriceAttestation size");

        bpa.attestations = new PythStructs.PriceAttestation[](bpa.nAttestations);

        // Deserialize each attestation
        for (uint j=0; j < bpa.nAttestations; j++) {
            // Header
            bpa.attestations[j].header.magic = encoded.toUint32(index);
            index += 4;
            require(bpa.attestations[j].header.magic == 0x50325748, "invalid magic value");

            bpa.attestations[j].header.version = encoded.toUint16(index);
            index += 2;
            require(bpa.attestations[j].header.version == 2, "invalid version");

            bpa.attestations[j].header.payloadId = encoded.toUint8(index);
            index += 1;
            // Payload ID of 1 required for individual attestation
            require(bpa.attestations[j].header.payloadId == 1, "invalid payload ID");

            // Attestation
            bpa.attestations[j].productId = encoded.toBytes32(index);
            index += 32;

            bpa.attestations[j].priceId = encoded.toBytes32(index);
            index += 32;
            bpa.attestations[j].priceType = encoded.toUint8(index);
            index += 1;

            bpa.attestations[j].price = int64(encoded.toUint64(index));
            index += 8;

            bpa.attestations[j].exponent = int32(encoded.toUint32(index));
            index += 4;

            bpa.attestations[j].emaPrice.value = int64(encoded.toUint64(index));
            index += 8;
            bpa.attestations[j].emaPrice.numerator = int64(encoded.toUint64(index));
            index += 8;
            bpa.attestations[j].emaPrice.denominator = int64(encoded.toUint64(index));
            index += 8;

            bpa.attestations[j].emaConf.value = int64(encoded.toUint64(index));
            index += 8;
            bpa.attestations[j].emaConf.numerator = int64(encoded.toUint64(index));
            index += 8;
            bpa.attestations[j].emaConf.denominator = int64(encoded.toUint64(index));
            index += 8;

            bpa.attestations[j].confidenceInterval = encoded.toUint64(index);
            index += 8;

            bpa.attestations[j].status = encoded.toUint8(index);
            index += 1;
            bpa.attestations[j].corpAct = encoded.toUint8(index);
            index += 1;

            bpa.attestations[j].timestamp = encoded.toUint64(index);
            index += 8;

            bpa.attestations[j].num_publishers = encoded.toUint32(index);
            index += 4;
        }
    }

    /// Maximum acceptable time period before price is considered to be stale.
    /// 
    /// This includes attestation delay which currently might up to a minute.
    uint private constant VALID_TIME_PERIOD_SECS = 180;

    function queryPriceFeed(bytes32 id) public view returns (PythStructs.PriceFeedResponse memory priceFeed){

        // Look up the latest price info for the given ID
        PythStructs.PriceInfo memory info = latestPriceInfo(id);
        require(info.priceFeed.id != 0, "no price feed found for the given price id");

        // Check that there is not a significant difference between this chain's time
        // and the attestation time. This is a last-resort safety net, and this check
        // will be iterated on in the future.
        if (diff(block.timestamp, info.attestationTime) > VALID_TIME_PERIOD_SECS) {
            info.priceFeed.status = PythSDK.PriceStatus.UNKNOWN;
        }
        
        return PythStructs.PriceFeedResponse({priceFeed: info.priceFeed});
    }

    function diff(uint x, uint y) private pure returns (uint) {
        if (x > y) {
            return x - y;
        } else {
            return y - x;
        }
    }
}

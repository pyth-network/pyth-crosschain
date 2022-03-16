// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

import "./PythGetters.sol";
import "./PythSetters.sol";
import "./PythStructs.sol";
import "./PythGovernance.sol";

contract Pyth is PythGovernance {
    using BytesLib for bytes;

    function attestPrice(bytes memory encodedVm) public returns (PythStructs.PriceAttestation memory pa) {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

        require(valid, reason);
        require(verifyPythVM(vm), "invalid emitter");

        PythStructs.PriceAttestation memory price = parsePriceAttestation(vm.payload);

        PythStructs.PriceInfo memory latestPrice = latestPriceInfo(pa.priceId);

        if(price.timestamp > latestPrice.attestation_time) {
            setLatestPriceInfo(price.priceId, newPriceInfo(price));
        }

        return price;
    }

    
    function newPriceInfo(PythStructs.PriceAttestation memory pa) private view returns (PythStructs.PriceInfo memory info) {
        info.attestation_time = pa.timestamp;
        info.arrival_time = block.timestamp;
        info.arrival_block = block.number;
        
        info.price.id = pa.priceId;
        info.price.price = pa.price;
        info.price.conf = pa.confidenceInterval;
        info.price.status = PythSDK.PriceStatus(pa.status);
        info.price.expo = pa.exponent;
        info.price.emaPrice = pa.emaPrice.value;
        info.price.emaConf = uint64(pa.emaConf.value);
        info.price.productId = pa.productId;

        // These aren't sent in the wire format yet
        info.price.numPublishers = 0;
        info.price.maxNumPublishers = 0;
        return info;
    }

    function verifyPythVM(IWormhole.VM memory vm) public view returns (bool valid) {
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
        }
    }

    function parsePriceAttestation(bytes memory encodedPriceAttestation) public pure returns (PythStructs.PriceAttestation memory pa) {
        uint index = 0;

        pa.header.magic = encodedPriceAttestation.toUint32(index);
        index += 4;
        require(pa.header.magic == 0x50325748, "invalid protocol");

        pa.header.version = encodedPriceAttestation.toUint16(index);
        index += 2;
        require(pa.header.version == 1, "invalid protocol");

        pa.header.payloadId = encodedPriceAttestation.toUint8(index);
        index += 1;
        require(pa.header.payloadId == 1, "invalid PriceAttestation");

        pa.productId = encodedPriceAttestation.toBytes32(index);
        index += 32;
        pa.priceId = encodedPriceAttestation.toBytes32(index);
        index += 32;

        pa.priceType = encodedPriceAttestation.toUint8(index);
        index += 1;

        pa.price = int64(encodedPriceAttestation.toUint64(index));
        index += 8;
        pa.exponent = int32(encodedPriceAttestation.toUint32(index));
        index += 4;

        pa.emaPrice.value = int64(encodedPriceAttestation.toUint64(index));
        index += 8;
        pa.emaPrice.numerator = int64(encodedPriceAttestation.toUint64(index));
        index += 8;
        pa.emaPrice.denominator = int64(encodedPriceAttestation.toUint64(index));
        index += 8;

        pa.emaConf.value = int64(encodedPriceAttestation.toUint64(index));
        index += 8;
        pa.emaConf.numerator = int64(encodedPriceAttestation.toUint64(index));
        index += 8;
        pa.emaConf.denominator = int64(encodedPriceAttestation.toUint64(index));
        index += 8;

        pa.confidenceInterval = encodedPriceAttestation.toUint64(index);
        index += 8;

        pa.status = encodedPriceAttestation.toUint8(index);
        index += 1;
        pa.corpAct = encodedPriceAttestation.toUint8(index);
        index += 1;

        pa.timestamp = encodedPriceAttestation.toUint64(index);
        index += 8;

        require(encodedPriceAttestation.length == index, "invalid PriceAttestation");
    }
}

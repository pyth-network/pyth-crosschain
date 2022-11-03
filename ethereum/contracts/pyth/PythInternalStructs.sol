// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythInternalStructs {
    using BytesLib for bytes;

    struct BatchPriceAttestation {
        Header header;

        uint16 nAttestations;
        uint16 attestationSize;
        PriceAttestation[] attestations;
    }

    struct Header {
        uint32 magic;
        uint16 versionMajor;
        uint16 versionMinor;
        uint16 hdrSize;
        uint8 payloadId;
    }

    struct PriceAttestation {
        bytes32 productId;
        bytes32 priceId;
        int64 price;
        uint64 conf;
        int32 expo;
        int64 emaPrice;
        uint64 emaConf;
        uint8 status;
        uint32 numPublishers;
        uint32 maxNumPublishers;
        uint64 attestationTime;
        uint64 publishTime;
        uint64 prevPublishTime;
        int64 prevPrice;
        uint64 prevConf;
    }

 struct PriceInfo {
        // slot 1
        int64 price;
        uint64 conf;
        uint64 publishTime;
        int32 expo;

        // slot 2
        int64 emaPrice;
        uint64 emaConf;
        uint64 emaPublishTime;
        int32 emaExpo;
    }

    struct DataSource {
        uint16 chainId;
        bytes32 emitterAddress;
    }

    /* PriceAttestationStatus represents the availability status of a price feed passed down in attestation.
        UNKNOWN: The price feed is not currently updating for an unknown reason.
        TRADING: The price feed is updating as expected.
        HALTED: The price feed is not currently updating because trading in the product has been halted.
        AUCTION: The price feed is not currently updating because an auction is setting the price.
    */
    enum PriceAttestationStatus {
        UNKNOWN,
        TRADING,
        HALTED,
        AUCTION
    }
}

// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "./PythSDK.sol";

contract PythStructs {
    using BytesLib for bytes;

    struct BatchPriceAttestation {
        Header header;

        uint16 nAttestations;
        uint16 attestationSize;
        PriceAttestation[] attestations;
    }

    struct Header {
        uint32 magic;
        uint16 version;
        uint8 payloadId;
    }

    struct PriceAttestation {
        Header header;

        bytes32 productId;
        bytes32 priceId;
        uint8 priceType;

        int64 price;
        int32 exponent;

        Rational emaPrice;
        Rational emaConf;

        uint64 confidenceInterval;

        uint8 status;
        uint8 corpAct;

        uint64 timestamp;
    }

    struct Rational {
        int64 value;
        int64 numerator;
        int64 denominator;
    }

    struct UpgradeContract {
        bytes32 module;
        uint8 action;
        uint16 chain;

        address newContract;
    }

    struct PriceInfo {
        PythSDK.PriceFeed priceFeed;
        uint256 attestationTime;
        uint256 arrivalTime;
        uint256 arrivalBlock;
    }

    struct PriceFeedResponse {
        PythSDK.PriceFeed priceFeed;
    }
}

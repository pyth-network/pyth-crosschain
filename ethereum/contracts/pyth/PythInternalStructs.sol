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
	uint32 num_publishers;
	uint32 max_num_publishers;
	uint64 publish_time;
	uint64 prev_publish_time;
	int64 prev_price;
	uint64 prev_conf;
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
        PythStructs.PriceFeed priceFeed;
        uint256 attestationTime;
        uint256 arrivalTime;
        uint256 arrivalBlock;
    }
}

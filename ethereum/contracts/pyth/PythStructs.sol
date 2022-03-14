// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

contract PythStructs {
    using BytesLib for bytes;

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
}

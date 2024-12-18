// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythInternalStructs {
    using BytesLib for bytes;

    struct ParseConfig {
        uint64 minPublishTime;
        uint64 maxPublishTime;
        bool checkUniqueness;
    }

    struct PriceInfo {
        // slot 1
        uint64 publishTime;
        int32 expo;
        int64 price;
        uint64 conf;
        // slot 2
        int64 emaPrice;
        uint64 emaConf;
    }

    struct DataSource {
        uint16 chainId;
        bytes32 emitterAddress;
    }

    struct TwapInfo {
        bytes32 feedId;
        uint64 startTime;
        uint64 endTime;
        int64 price;
        uint64 conf;
        int32 exponent;
    }
}

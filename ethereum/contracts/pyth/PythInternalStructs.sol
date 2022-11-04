// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythInternalStructs {
    using BytesLib for bytes;

    struct InternalPrice {
        int64 price;
        uint64 conf;
        uint64 publishTime;
        int32 expo;
    }

    struct PriceInfo {
        // slot 1
        InternalPrice price;

        // slot 2
        InternalPrice emaPrice;
    }

    struct DataSource {
        uint16 chainId;
        bytes32 emitterAddress;
    }
}

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

    /// Internal struct to hold parameters for update processing
    /// @dev Storing these variable in a struct rather than local variables
    /// helps reduce stack depth when passing arguments to functions.
    struct UpdateParseContext {
        bytes32[] priceIds;
        ParseConfig config;
        PythStructs.PriceFeed[] priceFeeds;
        uint64[] slots;
    }

    /// The initial Merkle header data in an AccumulatorUpdate. The encoded bytes
    /// are kept in calldata for gas efficiency.
    /// @dev Storing these variable in a struct rather than local variables
    /// helps reduce stack depth when passing arguments to functions.
    struct MerkleData {
        bytes20 digest;
        uint8 numUpdates;
        uint64 slot;
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
}

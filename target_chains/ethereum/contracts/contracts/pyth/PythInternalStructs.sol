// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythInternalStructs {
    using BytesLib for bytes;

    /// Internal struct to hold parameters for update processing
    /// @dev Storing these variable in a struct rather than local variables
    /// helps reduce stack depth when passing arguments to functions.
    struct UpdateParseContext {
        bytes32[] priceIds;
        uint64 minAllowedPublishTime;
        uint64 maxAllowedPublishTime;
        bool checkUniqueness;
        /// When checkUpdateDataIsMinimal is true, parsing will revert
        /// if the number of passed in updates exceeds or is less than
        /// the length of priceIds.
        bool checkUpdateDataIsMinimal;
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

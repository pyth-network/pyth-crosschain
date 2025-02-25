// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {PythLazer} from "./PythLazer.sol";

library PythLazerLib {
    enum PriceFeedProperty {
        Price,
        BestBidPrice,
        BestAskPrice,
        PublisherCount,
        Exponent
    }

    enum Channel {
        Invalid,
        RealTime,
        FixedRate50,
        FixedRate200
    }

    function parsePayloadHeader(
        bytes calldata update
    )
        public
        pure
        returns (uint64 timestamp, Channel channel, uint8 feedsLen, uint16 pos)
    {
        uint32 FORMAT_MAGIC = 2479346549;

        pos = 0;
        uint32 magic = uint32(bytes4(update[pos:pos + 4]));
        pos += 4;
        if (magic != FORMAT_MAGIC) {
            revert("invalid magic");
        }
        timestamp = uint64(bytes8(update[pos:pos + 8]));
        pos += 8;
        channel = Channel(uint8(update[pos]));
        pos += 1;
        feedsLen = uint8(update[pos]);
        pos += 1;
    }

    function parseFeedHeader(
        bytes calldata update,
        uint16 pos
    )
        public
        pure
        returns (uint32 feed_id, uint8 num_properties, uint16 new_pos)
    {
        feed_id = uint32(bytes4(update[pos:pos + 4]));
        pos += 4;
        num_properties = uint8(update[pos]);
        pos += 1;
        new_pos = pos;
    }

    function parseFeedProperty(
        bytes calldata update,
        uint16 pos
    ) public pure returns (PriceFeedProperty property, uint16 new_pos) {
        property = PriceFeedProperty(uint8(update[pos]));
        pos += 1;
        new_pos = pos;
    }

    function parseFeedValueUint64(
        bytes calldata update,
        uint16 pos
    ) public pure returns (uint64 value, uint16 new_pos) {
        value = uint64(bytes8(update[pos:pos + 8]));
        pos += 8;
        new_pos = pos;
    }

    function parseFeedValueUint16(
        bytes calldata update,
        uint16 pos
    ) public pure returns (uint16 value, uint16 new_pos) {
        value = uint16(bytes2(update[pos:pos + 2]));
        pos += 2;
        new_pos = pos;
    }

    function parseFeedValueInt16(
        bytes calldata update,
        uint16 pos
    ) public pure returns (int16 value, uint16 new_pos) {
        value = int16(uint16(bytes2(update[pos:pos + 2])));
        pos += 2;
        new_pos = pos;
    }

    function parseFeedValueUint8(
        bytes calldata update,
        uint16 pos
    ) public pure returns (uint8 value, uint16 new_pos) {
        value = uint8(update[pos]);
        pos += 1;
        new_pos = pos;
    }
}

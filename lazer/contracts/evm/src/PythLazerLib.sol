// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {PythLazer} from "./PythLazer.sol";
import {PythLazerStructs} from "./PythLazerStructs.sol";

library PythLazerLib {

    function parsePayloadHeader(
        bytes calldata update
    )
        public
        pure
        returns (uint64 timestamp, PythLazerStructs.Channel channel, uint8 feedsLen, uint16 pos)
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
        channel = PythLazerStructs.Channel(uint8(update[pos]));
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
    ) public pure returns (PythLazerStructs.PriceFeedProperty property, uint16 new_pos) {
        property = PythLazerStructs.PriceFeedProperty(uint8(update[pos]));
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

    function parseFeedValueInt64(
        bytes calldata update,
        uint16 pos
    ) public pure returns (int64 value, uint16 new_pos) {
        value = int64(uint64(bytes8(update[pos:pos + 8])));
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

    /// @notice Parse complete update from payload bytes
    /// @dev This is the main entry point for parsing a verified payload into the Update struct
    /// @param payload The payload bytes (after signature verification)
    /// @return update The parsed Update struct containing all feeds and their properties
    function parseUpdateFromPayload(
        bytes calldata payload
    ) public pure returns (PythLazerStructs.Update memory update) {
        // Parse payload header
        uint16 pos;
        uint8 feedsLen;
        (update.timestamp, update.channel, feedsLen, pos) = parsePayloadHeader(payload);

        // Initialize feeds array
        update.feeds = new PythLazerStructs.Feed[](feedsLen);

        // Parse each feed
        for (uint8 i = 0; i < feedsLen; i++) {
            PythLazerStructs.Feed memory feed;
            
            // Parse feed header (feed ID and number of properties)
            uint32 feedId;
            uint8 numProperties;
            (feedId, numProperties, pos) = parseFeedHeader(payload, pos);
            
            // Initialize feed
            feed.feedId = feedId;
            feed.existsFlags = 0;
            
            // Parse each property
            for (uint8 j = 0; j < numProperties; j++) {
                // Read property ID
                PythLazerStructs.PriceFeedProperty property;
                (property, pos) = parseFeedProperty(payload, pos);
                
                // Parse value and set flag based on property type
                // Price Property
                if (property == PythLazerStructs.PriceFeedProperty.Price) {
                    (feed.price, pos) = parseFeedValueInt64(payload, pos);
                    if (feed.price != 0) feed.existsFlags |= PythLazerStructs.PRICE_EXISTS;
                    
                // Best Bid Price Property
                } else if (property == PythLazerStructs.PriceFeedProperty.BestBidPrice) {
                    (feed.bestBidPrice, pos) = parseFeedValueInt64(payload, pos);
                    if (feed.bestBidPrice != 0) feed.existsFlags |= PythLazerStructs.BEST_BID_EXISTS;
                    
                // Best Ask Price Property
                } else if (property == PythLazerStructs.PriceFeedProperty.BestAskPrice) {
                    (feed.bestAskPrice, pos) = parseFeedValueInt64(payload, pos);
                    if (feed.bestAskPrice != 0) feed.existsFlags |= PythLazerStructs.BEST_ASK_EXISTS;
                    
                // Publisher Count Property
                } else if (property == PythLazerStructs.PriceFeedProperty.PublisherCount) {
                    (feed.publisherCount, pos) = parseFeedValueUint16(payload, pos);
                    feed.existsFlags |= PythLazerStructs.PUBLISHER_COUNT_EXISTS;
                    
                // Exponent Property
                } else if (property == PythLazerStructs.PriceFeedProperty.Exponent) {
                    (feed.exponent, pos) = parseFeedValueInt16(payload, pos);
                    feed.existsFlags |= PythLazerStructs.EXPONENT_EXISTS;
                    
                // Confidence Property
                } else if (property == PythLazerStructs.PriceFeedProperty.Confidence) {
                    (feed.confidence, pos) = parseFeedValueInt64(payload, pos);
                    if (feed.confidence != 0) feed.existsFlags |= PythLazerStructs.CONFIDENCE_EXISTS;
                    
                // Funding Rate Property
                } else if (property == PythLazerStructs.PriceFeedProperty.FundingRate) {
                    (feed.fundingRate, pos) = parseFeedValueInt64(payload, pos);
                    if (feed.fundingRate != 0) feed.existsFlags |= PythLazerStructs.FUNDING_RATE_EXISTS;
                    
                // Funding Timestamp Property
                } else if (property == PythLazerStructs.PriceFeedProperty.FundingTimestamp) {
                    (feed.fundingTimestamp, pos) = parseFeedValueUint64(payload, pos);
                    if (feed.fundingTimestamp != 0) feed.existsFlags |= PythLazerStructs.FUNDING_TS_EXISTS;
                    
                // Funding Rate Interval Property
                } else if (property == PythLazerStructs.PriceFeedProperty.FundingRateInterval) {   
                    (feed.fundingRateInterval, pos) = parseFeedValueUint64(payload, pos);
                    if (feed.fundingRateInterval != 0) feed.existsFlags |= PythLazerStructs.FUNDING_INTERVAL_EXISTS;
                    
                } else {
                    revert("Unknown property");
                }
            }
            
            // Store feed in update
            update.feeds[i] = feed;
        }
        
        // Ensure we consumed all bytes
        require(pos == payload.length, "Payload not fully consumed");
    }


    // Helper functions for existence checks

    /// @notice Check if price exists
    function hasPrice(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.PRICE_EXISTS) != 0;
    }

    /// @notice Check if best bid price exists
    function hasBestBidPrice(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.BEST_BID_EXISTS) != 0;
    }

    /// @notice Check if best ask price exists
    function hasBestAskPrice(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.BEST_ASK_EXISTS) != 0;
    }

    /// @notice Check if publisher count exists
    function hasPublisherCount(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.PUBLISHER_COUNT_EXISTS) != 0;
    }

    /// @notice Check if exponent exists
    function hasExponent(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.EXPONENT_EXISTS) != 0;
    }

    /// @notice Check if confidence exists
    function hasConfidence(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.CONFIDENCE_EXISTS) != 0;
    }

    /// @notice Check if funding rate exists
    function hasFundingRate(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.FUNDING_RATE_EXISTS) != 0;
    }

    /// @notice Check if funding timestamp exists
    function hasFundingTimestamp(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.FUNDING_TS_EXISTS) != 0;
    }

    /// @notice Check if funding rate interval exists
    function hasFundingRateInterval(PythLazerStructs.Feed memory feed) public pure returns (bool) {
        return (feed.existsFlags & PythLazerStructs.FUNDING_INTERVAL_EXISTS) != 0;
    }

    // Safe getter functions (revert if property doesn't exist)

    /// @notice Get price (reverts if not exists)
    function getPrice(PythLazerStructs.Feed memory feed) public pure returns (int64) {
        require(hasPrice(feed), "Price does not exist");
        return feed.price;
    }

    /// @notice Get best bid price (reverts if not exists)
    function getBestBidPrice(PythLazerStructs.Feed memory feed) public pure returns (int64) {
        require(hasBestBidPrice(feed), "Best bid price does not exist");
        return feed.bestBidPrice;
    }

    /// @notice Get best ask price (reverts if not exists)
    function getBestAskPrice(PythLazerStructs.Feed memory feed) public pure returns (int64) {
        require(hasBestAskPrice(feed), "Best ask price does not exist");
        return feed.bestAskPrice;
    }

    /// @notice Get publisher count (reverts if not exists)
    function getPublisherCount(PythLazerStructs.Feed memory feed) public pure returns (uint16) {
        require(hasPublisherCount(feed), "Publisher count does not exist");
        return feed.publisherCount;
    }

    /// @notice Get exponent (reverts if not exists)
    function getExponent(PythLazerStructs.Feed memory feed) public pure returns (int16) {
        require(hasExponent(feed), "Exponent does not exist");
        return feed.exponent;
    }

    /// @notice Get confidence (reverts if not exists)
    function getConfidence(PythLazerStructs.Feed memory feed) public pure returns (int64) {
        require(hasConfidence(feed), "Confidence does not exist");
        return feed.confidence;
    }

    /// @notice Get funding rate (reverts if not exists)
    function getFundingRate(PythLazerStructs.Feed memory feed) public pure returns (int64) {
        require(hasFundingRate(feed), "Funding rate does not exist");
        return feed.fundingRate;
    }

    /// @notice Get funding timestamp (reverts if not exists)
    function getFundingTimestamp(PythLazerStructs.Feed memory feed) public pure returns (uint64) {
        require(hasFundingTimestamp(feed), "Funding timestamp does not exist");
        return feed.fundingTimestamp;
    }

    /// @notice Get funding rate interval (reverts if not exists)
    function getFundingRateInterval(PythLazerStructs.Feed memory feed) public pure returns (uint64) {
        require(hasFundingRateInterval(feed), "Funding rate interval does not exist");
        return feed.fundingRateInterval;
    }
}

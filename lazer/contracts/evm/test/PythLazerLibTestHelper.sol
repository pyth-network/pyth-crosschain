// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {PythLazerLib} from "../src/PythLazerLib.sol";
import {PythLazerStructs} from "../src/PythLazerStructs.sol";

/// @notice Test helper contract that exposes internal library functions for testing
/// @dev This contract wraps internal library functions with external functions
///      so tests can call them with memory bytes (converted to calldata)
contract PythLazerLibTestHelper {
    function parseUpdateFromPayload(
        bytes calldata payload
    ) external pure returns (PythLazerStructs.Update memory) {
        return PythLazerLib.parseUpdateFromPayload(payload);
    }

    function parsePayloadHeader(
        bytes calldata update
    )
        external
        pure
        returns (
            uint64 timestamp,
            PythLazerStructs.Channel channel,
            uint8 feedsLen,
            uint16 pos
        )
    {
        return PythLazerLib.parsePayloadHeader(update);
    }

    function parseFeedHeader(
        bytes calldata update,
        uint16 pos
    )
        external
        pure
        returns (uint32 feed_id, uint8 num_properties, uint16 new_pos)
    {
        return PythLazerLib.parseFeedHeader(update, pos);
    }

    function parseFeedProperty(
        bytes calldata update,
        uint16 pos
    )
        external
        pure
        returns (PythLazerStructs.PriceFeedProperty property, uint16 new_pos)
    {
        return PythLazerLib.parseFeedProperty(update, pos);
    }

    // Existence check helpers
    function hasPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasPrice(feed);
    }

    function hasBestBidPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasBestBidPrice(feed);
    }

    function hasBestAskPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasBestAskPrice(feed);
    }

    function hasPublisherCount(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasPublisherCount(feed);
    }

    function hasExponent(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasExponent(feed);
    }

    function hasConfidence(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasConfidence(feed);
    }

    function hasFundingRate(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasFundingRate(feed);
    }

    function hasFundingTimestamp(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasFundingTimestamp(feed);
    }

    function hasFundingRateInterval(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasFundingRateInterval(feed);
    }

    function hasMarketSession(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.hasMarketSession(feed);
    }

    // Requested check helpers
    function isPriceRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isPriceRequested(feed);
    }

    function isBestBidPriceRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isBestBidPriceRequested(feed);
    }

    function isBestAskPriceRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isBestAskPriceRequested(feed);
    }

    function isPublisherCountRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isPublisherCountRequested(feed);
    }

    function isExponentRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isExponentRequested(feed);
    }

    function isConfidenceRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isConfidenceRequested(feed);
    }

    function isFundingRateRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isFundingRateRequested(feed);
    }

    function isFundingTimestampRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isFundingTimestampRequested(feed);
    }

    function isFundingRateIntervalRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isFundingRateIntervalRequested(feed);
    }

    function isMarketSessionRequested(
        PythLazerStructs.Feed memory feed
    ) external pure returns (bool) {
        return PythLazerLib.isMarketSessionRequested(feed);
    }

    // Safe getter helpers
    function getPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (int64) {
        return PythLazerLib.getPrice(feed);
    }

    function getBestBidPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (int64) {
        return PythLazerLib.getBestBidPrice(feed);
    }

    function getBestAskPrice(
        PythLazerStructs.Feed memory feed
    ) external pure returns (int64) {
        return PythLazerLib.getBestAskPrice(feed);
    }

    function getPublisherCount(
        PythLazerStructs.Feed memory feed
    ) external pure returns (uint16) {
        return PythLazerLib.getPublisherCount(feed);
    }

    function getExponent(
        PythLazerStructs.Feed memory feed
    ) external pure returns (int16) {
        return PythLazerLib.getExponent(feed);
    }

    function getConfidence(
        PythLazerStructs.Feed memory feed
    ) external pure returns (uint64) {
        return PythLazerLib.getConfidence(feed);
    }

    function getFundingRate(
        PythLazerStructs.Feed memory feed
    ) external pure returns (int64) {
        return PythLazerLib.getFundingRate(feed);
    }

    function getFundingTimestamp(
        PythLazerStructs.Feed memory feed
    ) external pure returns (uint64) {
        return PythLazerLib.getFundingTimestamp(feed);
    }

    function getFundingRateInterval(
        PythLazerStructs.Feed memory feed
    ) external pure returns (uint64) {
        return PythLazerLib.getFundingRateInterval(feed);
    }

    function getMarketSession(
        PythLazerStructs.Feed memory feed
    ) external pure returns (PythLazerStructs.MarketSession) {
        return PythLazerLib.getMarketSession(feed);
    }
}

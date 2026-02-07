// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {PythLazerStructs} from "./PythLazerStructs.sol";

library PythLazerLib {
    // --- Internal tri-state helpers ---
    // triStateMap packs 2 bits per property at bit positions [2*p, 2*p+1]
    function _setTriState(
        PythLazerStructs.Feed memory feed,
        uint8 propId,
        PythLazerStructs.PropertyState state
    ) private pure {
        // Build a mask with zeros at the target 2-bit window and ones elsewhere
        //   uint256(3) is binary 11; shift it left into the window for this property
        //   ~ inverts the bits to create a clearing mask for just that window
        uint256 mask = ~(uint256(3) << (2 * propId));
        // Clear the window, then OR-in the desired state shifted into position
        feed.triStateMap =
            (feed.triStateMap & mask) |
            (uint256(uint8(state)) << (2 * propId));
    }

    function _setApplicableButMissing(
        PythLazerStructs.Feed memory feed,
        uint8 propId
    ) private pure {
        _setTriState(
            feed,
            propId,
            PythLazerStructs.PropertyState.ApplicableButMissing
        );
    }

    function _setPresent(
        PythLazerStructs.Feed memory feed,
        uint8 propId
    ) private pure {
        _setTriState(feed, propId, PythLazerStructs.PropertyState.Present);
    }

    function _hasValue(
        PythLazerStructs.Feed memory feed,
        uint8 propId
    ) private pure returns (bool) {
        // Shift the property window down to bits [0,1], mask with 0b11 (3), compare to Present (2)
        return
            ((feed.triStateMap >> (2 * propId)) & 3) ==
            uint256(uint8(PythLazerStructs.PropertyState.Present));
    }

    function _isRequested(
        PythLazerStructs.Feed memory feed,
        uint8 propId
    ) private pure returns (bool) {
        // Requested if state != NotApplicable (i.e., any non-zero)
        return ((feed.triStateMap >> (2 * propId)) & 3) != 0;
    }

    // ============================================================================
    // Parsing functions (for bytes memory payloads)
    // ============================================================================

    // Helper functions to read from bytes memory (since slicing doesn't work)
    // These use assembly to read the correct number of bytes and handle endianness
    function _readBytes1(
        bytes memory data,
        uint16 pos
    ) private pure returns (uint8 value) {
        assembly {
            let word := mload(add(add(data, 0x20), pos))
            // Read first byte (most significant byte in the word)
            value := shr(248, word)
        }
    }

    function _readBytes2(
        bytes memory data,
        uint16 pos
    ) private pure returns (uint16 value) {
        assembly {
            let word := mload(add(add(data, 0x20), pos))
            // Read first 2 bytes (most significant bytes in the word)
            value := shr(240, word)
        }
    }

    function _readBytes4(
        bytes memory data,
        uint16 pos
    ) private pure returns (uint32 value) {
        assembly {
            let word := mload(add(add(data, 0x20), pos))
            // Read first 4 bytes (most significant bytes in the word)
            value := shr(224, word)
        }
    }

    function _readBytes8(
        bytes memory data,
        uint16 pos
    ) private pure returns (uint64 value) {
        assembly {
            let word := mload(add(add(data, 0x20), pos))
            // Read first 8 bytes (most significant bytes in the word)
            value := shr(192, word)
        }
    }

    function parsePayloadHeader(
        bytes memory update
    )
        public
        pure
        returns (
            uint64 timestamp,
            PythLazerStructs.Channel channel,
            uint8 feedsLen,
            uint16 pos
        )
    {
        uint32 FORMAT_MAGIC = 2479346549;

        pos = 0;
        uint32 magic = _readBytes4(update, pos);
        pos += 4;
        if (magic != FORMAT_MAGIC) {
            revert("invalid magic");
        }
        timestamp = _readBytes8(update, pos);
        pos += 8;
        channel = PythLazerStructs.Channel(_readBytes1(update, pos));
        pos += 1;
        feedsLen = uint8(_readBytes1(update, pos));
        pos += 1;
    }

    function parseFeedHeader(
        bytes memory update,
        uint16 pos
    )
        public
        pure
        returns (uint32 feed_id, uint8 num_properties, uint16 new_pos)
    {
        feed_id = _readBytes4(update, pos);
        pos += 4;
        num_properties = uint8(_readBytes1(update, pos));
        pos += 1;
        new_pos = pos;
    }

    function parseFeedProperty(
        bytes memory update,
        uint16 pos
    )
        public
        pure
        returns (PythLazerStructs.PriceFeedProperty property, uint16 new_pos)
    {
        uint8 propertyId = _readBytes1(update, pos);
        require(propertyId <= 12, "Unknown property");
        property = PythLazerStructs.PriceFeedProperty(propertyId);
        pos += 1;
        new_pos = pos;
    }

    function parseFeedValueUint64(
        bytes memory update,
        uint16 pos
    ) internal pure returns (uint64 value, uint16 new_pos) {
        value = _readBytes8(update, pos);
        pos += 8;
        new_pos = pos;
    }

    function parseFeedValueInt64(
        bytes memory update,
        uint16 pos
    ) internal pure returns (int64 value, uint16 new_pos) {
        value = int64(_readBytes8(update, pos));
        pos += 8;
        new_pos = pos;
    }

    function parseFeedValueUint16(
        bytes memory update,
        uint16 pos
    ) internal pure returns (uint16 value, uint16 new_pos) {
        value = _readBytes2(update, pos);
        pos += 2;
        new_pos = pos;
    }

    function parseFeedValueInt16(
        bytes memory update,
        uint16 pos
    ) internal pure returns (int16 value, uint16 new_pos) {
        value = int16(_readBytes2(update, pos));
        pos += 2;
        new_pos = pos;
    }

    function parseFeedValueUint8(
        bytes memory update,
        uint16 pos
    ) internal pure returns (uint8 value, uint16 new_pos) {
        value = _readBytes1(update, pos);
        pos += 1;
        new_pos = pos;
    }

    /// @notice Parse complete update from payload bytes
    /// @dev This is the main entry point for parsing a verified payload into the Update struct
    /// @param payload The payload bytes (after signature verification)
    /// @return update The parsed Update struct containing all feeds and their properties
    function parseUpdateFromPayload(
        bytes memory payload
    ) public pure returns (PythLazerStructs.Update memory update) {
        // Parse payload header
        uint16 pos;
        uint8 feedsLen;
        (update.timestamp, update.channel, feedsLen, pos) = parsePayloadHeader(
            payload
        );

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
            feed.triStateMap = 0;

            // Parse each property
            for (uint8 j = 0; j < numProperties; j++) {
                // Read property ID
                PythLazerStructs.PriceFeedProperty property;
                (property, pos) = parseFeedProperty(payload, pos);

                // Parse value and set tri-state based on property type
                // Price Property
                if (property == PythLazerStructs.PriceFeedProperty.Price) {
                    (feed._price, pos) = parseFeedValueInt64(payload, pos);
                    if (feed._price != 0) {
                        _setPresent(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.Price)
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.Price)
                        );
                    }

                    // Best Bid Price Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.BestBidPrice
                ) {
                    (feed._bestBidPrice, pos) = parseFeedValueInt64(
                        payload,
                        pos
                    );
                    if (feed._bestBidPrice != 0) {
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.BestBidPrice
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.BestBidPrice
                            )
                        );
                    }

                    // Best Ask Price Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.BestAskPrice
                ) {
                    (feed._bestAskPrice, pos) = parseFeedValueInt64(
                        payload,
                        pos
                    );
                    if (feed._bestAskPrice != 0) {
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.BestAskPrice
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.BestAskPrice
                            )
                        );
                    }

                    // Publisher Count Property
                } else if (
                    property ==
                    PythLazerStructs.PriceFeedProperty.PublisherCount
                ) {
                    (feed._publisherCount, pos) = parseFeedValueUint16(
                        payload,
                        pos
                    );
                    if (feed._publisherCount != 0) {
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .PublisherCount
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .PublisherCount
                            )
                        );
                    }

                    // Exponent Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.Exponent
                ) {
                    (feed._exponent, pos) = parseFeedValueInt16(payload, pos);
                    _setPresent(
                        feed,
                        uint8(PythLazerStructs.PriceFeedProperty.Exponent)
                    );

                    // Confidence Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.Confidence
                ) {
                    (feed._confidence, pos) = parseFeedValueUint64(
                        payload,
                        pos
                    );
                    if (feed._confidence != 0) {
                        _setPresent(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.Confidence)
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.Confidence)
                        );
                    }

                    // Funding Rate Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.FundingRate
                ) {
                    uint8 exists;
                    (exists, pos) = parseFeedValueUint8(payload, pos);
                    if (exists != 0) {
                        (feed._fundingRate, pos) = parseFeedValueInt64(
                            payload,
                            pos
                        );
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.FundingRate
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.FundingRate
                            )
                        );
                    }

                    // Funding Timestamp Property
                } else if (
                    property ==
                    PythLazerStructs.PriceFeedProperty.FundingTimestamp
                ) {
                    uint8 exists;
                    (exists, pos) = parseFeedValueUint8(payload, pos);
                    if (exists != 0) {
                        (feed._fundingTimestamp, pos) = parseFeedValueUint64(
                            payload,
                            pos
                        );
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FundingTimestamp
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FundingTimestamp
                            )
                        );
                    }

                    // Funding Rate Interval Property
                } else if (
                    property ==
                    PythLazerStructs.PriceFeedProperty.FundingRateInterval
                ) {
                    uint8 exists;
                    (exists, pos) = parseFeedValueUint8(payload, pos);
                    if (exists != 0) {
                        (feed._fundingRateInterval, pos) = parseFeedValueUint64(
                            payload,
                            pos
                        );
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FundingRateInterval
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FundingRateInterval
                            )
                        );
                    }

                    // Market Session Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.MarketSession
                ) {
                    int16 marketSessionValue;
                    (marketSessionValue, pos) = parseFeedValueInt16(
                        payload,
                        pos
                    );
                    require(
                        marketSessionValue >= 0 && marketSessionValue <= 4,
                        "Invalid market session value"
                    );
                    feed._marketSession = PythLazerStructs.MarketSession(
                        uint8(uint16(marketSessionValue))
                    );
                    _setPresent(
                        feed,
                        uint8(PythLazerStructs.PriceFeedProperty.MarketSession)
                    );
                    // EMA Price Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.EmaPrice
                ) {
                    (feed._emaPrice, pos) = parseFeedValueInt64(payload, pos);
                    if (feed._emaPrice != 0) {
                        _setPresent(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.EmaPrice)
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(PythLazerStructs.PriceFeedProperty.EmaPrice)
                        );
                    }
                    // EMA Confidence Property
                } else if (
                    property == PythLazerStructs.PriceFeedProperty.EmaConfidence
                ) {
                    (feed._emaConfidence, pos) = parseFeedValueUint64(
                        payload,
                        pos
                    );
                    if (feed._emaConfidence != 0) {
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.EmaConfidence
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs.PriceFeedProperty.EmaConfidence
                            )
                        );
                    }
                    // Feed Update Timestamp Property
                } else if (
                    property ==
                    PythLazerStructs.PriceFeedProperty.FeedUpdateTimestamp
                ) {
                    uint8 exists;
                    (exists, pos) = parseFeedValueUint8(payload, pos);
                    if (exists != 0) {
                        (feed._feedUpdateTimestamp, pos) = parseFeedValueUint64(
                            payload,
                            pos
                        );
                        _setPresent(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FeedUpdateTimestamp
                            )
                        );
                    } else {
                        _setApplicableButMissing(
                            feed,
                            uint8(
                                PythLazerStructs
                                    .PriceFeedProperty
                                    .FeedUpdateTimestamp
                            )
                        );
                    }
                } else {
                    // This should never happen due to validation in parseFeedProperty
                    revert("Unexpected property");
                }
            }

            // Store feed in update
            update.feeds[i] = feed;
        }

        // Ensure we consumed all bytes
        require(pos == payload.length, "Payload has extra unknown bytes");
    }

    // Helper functions for existence checks

    /// @notice Check if price exists
    function hasPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return _hasValue(feed, uint8(PythLazerStructs.PriceFeedProperty.Price));
    }

    /// @notice Check if best bid price exists
    function hasBestBidPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.BestBidPrice)
            );
    }

    /// @notice Check if best ask price exists
    function hasBestAskPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.BestAskPrice)
            );
    }

    /// @notice Check if publisher count exists
    function hasPublisherCount(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.PublisherCount)
            );
    }

    /// @notice Check if exponent exists
    function hasExponent(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(feed, uint8(PythLazerStructs.PriceFeedProperty.Exponent));
    }

    /// @notice Check if confidence exists
    function hasConfidence(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.Confidence)
            );
    }

    /// @notice Check if funding rate exists
    function hasFundingRate(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingRate)
            );
    }

    /// @notice Check if funding timestamp exists
    function hasFundingTimestamp(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingTimestamp)
            );
    }

    /// @notice Check if funding rate interval exists
    function hasFundingRateInterval(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingRateInterval)
            );
    }

    /// @notice Check if market session exists
    function hasMarketSession(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.MarketSession)
            );
    }

    /// @notice Check if EMA price exists
    function hasEmaPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(feed, uint8(PythLazerStructs.PriceFeedProperty.EmaPrice));
    }

    /// @notice Check if EMA confidence exists
    function hasEmaConfidence(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.EmaConfidence)
            );
    }

    /// @notice Check if feed update timestamp exists
    function hasFeedUpdateTimestamp(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _hasValue(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FeedUpdateTimestamp)
            );
    }

    // Requested helpers — property included in this update
    function isPriceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(feed, uint8(PythLazerStructs.PriceFeedProperty.Price));
    }

    function isBestBidPriceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.BestBidPrice)
            );
    }

    function isBestAskPriceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.BestAskPrice)
            );
    }

    function isPublisherCountRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.PublisherCount)
            );
    }

    function isExponentRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.Exponent)
            );
    }

    function isConfidenceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.Confidence)
            );
    }

    function isFundingRateRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingRate)
            );
    }

    function isFundingTimestampRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingTimestamp)
            );
    }

    function isFundingRateIntervalRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FundingRateInterval)
            );
    }

    function isMarketSessionRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.MarketSession)
            );
    }

    function isEmaPriceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.EmaPrice)
            );
    }

    function isEmaConfidenceRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.EmaConfidence)
            );
    }

    function isFeedUpdateTimestampRequested(
        PythLazerStructs.Feed memory feed
    ) public pure returns (bool) {
        return
            _isRequested(
                feed,
                uint8(PythLazerStructs.PriceFeedProperty.FeedUpdateTimestamp)
            );
    }

    // Safe getter functions (revert if property doesn't exist)

    /// @notice Get price (reverts if not exists)
    function getPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int64) {
        require(
            isPriceRequested(feed),
            "Price is not requested for the timestamp"
        );
        require(hasPrice(feed), "Price is not present for the timestamp");
        return feed._price;
    }

    /// @notice Get best bid price (reverts if not exists)
    function getBestBidPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int64) {
        require(
            isBestBidPriceRequested(feed),
            "Best bid price is not requested for the timestamp"
        );
        require(
            hasBestBidPrice(feed),
            "Best bid price is not present for the timestamp"
        );
        return feed._bestBidPrice;
    }

    /// @notice Get best ask price (reverts if not exists)
    function getBestAskPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int64) {
        require(
            isBestAskPriceRequested(feed),
            "Best ask price is not requested for the timestamp"
        );
        require(
            hasBestAskPrice(feed),
            "Best ask price is not present for the timestamp"
        );
        return feed._bestAskPrice;
    }

    /// @notice Get publisher count (reverts if not exists)
    function getPublisherCount(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint16) {
        require(
            isPublisherCountRequested(feed),
            "Publisher count is not requested for the timestamp"
        );
        require(
            hasPublisherCount(feed),
            "Publisher count is not present for the timestamp"
        );
        return feed._publisherCount;
    }

    /// @notice Get exponent (reverts if not exists)
    function getExponent(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int16) {
        require(
            isExponentRequested(feed),
            "Exponent is not requested for the timestamp"
        );
        require(hasExponent(feed), "Exponent is not present for the timestamp");
        return feed._exponent;
    }

    /// @notice Get confidence (reverts if not exists)
    function getConfidence(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint64) {
        require(
            isConfidenceRequested(feed),
            "Confidence is not requested for the timestamp"
        );
        require(
            hasConfidence(feed),
            "Confidence is not present for the timestamp"
        );
        return feed._confidence;
    }

    /// @notice Get funding rate (reverts if not exists)
    function getFundingRate(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int64) {
        require(
            isFundingRateRequested(feed),
            "Funding rate is not requested for the timestamp"
        );
        require(
            hasFundingRate(feed),
            "Funding rate is not present for the timestamp"
        );
        return feed._fundingRate;
    }

    /// @notice Get funding timestamp (reverts if not exists)
    function getFundingTimestamp(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint64) {
        require(
            isFundingTimestampRequested(feed),
            "Funding timestamp is not requested for the timestamp"
        );
        require(
            hasFundingTimestamp(feed),
            "Funding timestamp is not present for the timestamp"
        );
        return feed._fundingTimestamp;
    }

    /// @notice Get funding rate interval (reverts if not exists)
    function getFundingRateInterval(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint64) {
        require(
            isFundingRateIntervalRequested(feed),
            "Funding rate interval is not requested for the timestamp"
        );
        require(
            hasFundingRateInterval(feed),
            "Funding rate interval is not present for the timestamp"
        );
        return feed._fundingRateInterval;
    }

    /// @notice Get market session (reverts if not exists)
    function getMarketSession(
        PythLazerStructs.Feed memory feed
    ) public pure returns (PythLazerStructs.MarketSession) {
        require(
            isMarketSessionRequested(feed),
            "Market session is not requested for the timestamp"
        );
        require(
            hasMarketSession(feed),
            "Market session is not present for the timestamp"
        );
        return feed._marketSession;
    }

    /// @notice Get EMA price (reverts if not exists)
    function getEmaPrice(
        PythLazerStructs.Feed memory feed
    ) public pure returns (int64) {
        require(
            isEmaPriceRequested(feed),
            "EMA price is not requested for the timestamp"
        );
        require(
            hasEmaPrice(feed),
            "EMA price is not present for the timestamp"
        );
        return feed._emaPrice;
    }

    /// @notice Get EMA confidence (reverts if not exists)
    function getEmaConfidence(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint64) {
        require(
            isEmaConfidenceRequested(feed),
            "EMA confidence is not requested for the timestamp"
        );
        require(
            hasEmaConfidence(feed),
            "EMA confidence is not present for the timestamp"
        );
        return feed._emaConfidence;
    }

    /// @notice Get feed update timestamp (reverts if not exists)
    function getFeedUpdateTimestamp(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint64) {
        require(
            isFeedUpdateTimestampRequested(feed),
            "feed update timestamp is not requested for the timestamp"
        );
        require(
            hasFeedUpdateTimestamp(feed),
            "feed update timestamp is not present for the timestamp"
        );
        return feed._feedUpdateTimestamp;
    }

    /// @notice Get feed ID
    function getFeedId(
        PythLazerStructs.Feed memory feed
    ) public pure returns (uint32) {
        return feed.feedId;
    }
}

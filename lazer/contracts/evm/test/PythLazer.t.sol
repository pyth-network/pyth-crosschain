// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {PythLazerLib} from "../src/PythLazerLib.sol";
import {PythLazerStructs} from "../src/PythLazerStructs.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract PythLazerTest is Test {
    PythLazer public pythLazer;
    address owner;

    function setUp() public {
        owner = address(1);
        PythLazer pythLazerImpl = new PythLazer();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(pythLazerImpl),
            owner,
            abi.encodeWithSelector(PythLazer.initialize.selector, owner)
        );
        pythLazer = PythLazer(address(proxy));
    }

    function test_update_add_signer() public {
        assert(!pythLazer.isValidSigner(address(2)));
        vm.prank(owner);
        pythLazer.updateTrustedSigner(address(2), block.timestamp + 1000);
        assert(pythLazer.isValidSigner(address(2)));
        skip(2000);
        assert(!pythLazer.isValidSigner(address(2)));
    }

    function test_update_remove_signer() public {
        assert(!pythLazer.isValidSigner(address(2)));
        vm.prank(owner);
        pythLazer.updateTrustedSigner(address(2), block.timestamp + 1000);
        assert(pythLazer.isValidSigner(address(2)));

        vm.prank(owner);
        pythLazer.updateTrustedSigner(address(2), 0);
        assert(!pythLazer.isValidSigner(address(2)));
    }

    function test_verify() public {
        // Prepare dummy update and signer
        address trustedSigner = 0xb8d50f0bAE75BF6E03c104903d7C3aFc4a6596Da;
        vm.prank(owner);
        pythLazer.updateTrustedSigner(trustedSigner, 3000000000000000);
        bytes
            memory update = hex"2a22999a9ee4e2a3df5affd0ad8c7c46c96d3b5ef197dd653bedd8f44a4b6b69b767fbc66341e80b80acb09ead98c60d169b9a99657ebada101f447378f227bffbc69d3d01003493c7d37500062cf28659c1e801010000000605000000000005f5e10002000000000000000001000000000000000003000104fff8";

        uint256 fee = pythLazer.verification_fee();

        address alice = makeAddr("alice");
        vm.deal(alice, 1 ether);
        address bob = makeAddr("bob");
        vm.deal(bob, 1 ether);

        // Alice provides appropriate fee
        vm.prank(alice);
        pythLazer.verifyUpdate{value: fee}(update);
        assertEq(alice.balance, 1 ether - fee);

        // Alice overpays and is refunded
        vm.prank(alice);
        pythLazer.verifyUpdate{value: 0.5 ether}(update);
        assertEq(alice.balance, 1 ether - fee - fee);

        // Bob does not attach a fee
        vm.prank(bob);
        vm.expectRevert("Insufficient fee provided");
        pythLazer.verifyUpdate(update);
        assertEq(bob.balance, 1 ether);
    }

    // Helper Methods
    function buildPayload(
        uint64 timestamp,
        PythLazerStructs.Channel channel,
        bytes[] memory feedsData
    ) internal pure returns (bytes memory) {
        bytes memory payload = abi.encodePacked(
            uint32(2479346549), // PAYLOAD_FORMAT_MAGIC
            timestamp,
            uint8(channel),
            uint8(feedsData.length)
        );

        for (uint256 i = 0; i < feedsData.length; i++) {
            payload = bytes.concat(payload, feedsData[i]);
        }

        return payload;
    }

    function buildFeedData(
        uint32 feedId,
        bytes[] memory properties
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                feedId,
                uint8(properties.length),
                bytes.concat(
                    properties[0],
                    properties.length > 1 ? properties[1] : bytes("")
                )
            );
    }

    function concatProperties(
        bytes[] memory properties
    ) internal pure returns (bytes memory) {
        bytes memory result = "";
        for (uint256 i = 0; i < properties.length; i++) {
            result = bytes.concat(result, properties[i]);
        }
        return result;
    }

    function buildFeedDataMulti(
        uint32 feedId,
        bytes[] memory properties
    ) internal pure returns (bytes memory) {
        bytes memory propertiesBytes = concatProperties(properties);
        return
            abi.encodePacked(feedId, uint8(properties.length), propertiesBytes);
    }

    /// @notice Build a property with given ID and encoded value bytes
    /// @param propertyId The property ID (0-8)
    /// @param valueBytes The encoded value (int64/uint64 = 8 bytes, uint16/int16 = 2 bytes)
    function buildProperty(
        uint8 propertyId,
        bytes memory valueBytes
    ) internal pure returns (bytes memory) {
        // Funding properties (6, 7, 8) need a bool flag before the value
        if (propertyId >= 6 && propertyId <= 8) {
            return abi.encodePacked(propertyId, uint8(1), valueBytes);
        } else {
            return abi.encodePacked(propertyId, valueBytes);
        }
    }

    /// @notice Build a funding property with None value (just the bool flag = 0)
    /// @param propertyId The property ID (must be 6, 7, or 8)
    function buildPropertyNone(
        uint8 propertyId
    ) internal pure returns (bytes memory) {
        require(
            propertyId >= 6 && propertyId <= 8,
            "Only for funding properties"
        );
        return abi.encodePacked(propertyId, uint8(0));
    }

    function encodeInt64(int64 value) internal pure returns (bytes memory) {
        return abi.encodePacked(value);
    }

    function encodeUint64(uint64 value) internal pure returns (bytes memory) {
        return abi.encodePacked(value);
    }

    function encodeInt16(int16 value) internal pure returns (bytes memory) {
        return abi.encodePacked(value);
    }

    function encodeUint16(uint16 value) internal pure returns (bytes memory) {
        return abi.encodePacked(value);
    }

    /// @notice Test parsing single feed with all 9 properties
    function test_parseUpdate_singleFeed_allProperties() public pure {
        bytes[] memory properties = new bytes[](9);
        properties[0] = buildProperty(0, encodeInt64(100000000)); // price
        properties[1] = buildProperty(1, encodeInt64(99000000)); // bestBid
        properties[2] = buildProperty(2, encodeInt64(101000000)); // bestAsk
        properties[3] = buildProperty(3, encodeUint16(5)); // publisherCount
        properties[4] = buildProperty(4, encodeInt16(-8)); // exponent
        properties[5] = buildProperty(5, encodeInt64(50000)); // confidence
        properties[6] = buildProperty(6, encodeInt64(123456)); // fundingRate
        properties[7] = buildProperty(7, encodeUint64(1234567890)); // fundingTimestamp
        properties[8] = buildProperty(8, encodeUint64(3600)); // fundingRateInterval

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(1, properties); // feedId = 1

        bytes memory payload = buildPayload(
            1700000000, // random timestamp
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        // Verify update header
        assertEq(update.timestamp, 1700000000);
        assertEq(
            uint8(update.channel),
            uint8(PythLazerStructs.Channel.RealTime)
        );
        assertEq(update.feeds.length, 1);

        // Verify feed data
        PythLazerStructs.Feed memory feed = update.feeds[0];
        assertEq(feed.feedId, 1);
        assertEq(feed._price, 100000000);
        assertEq(feed._bestBidPrice, 99000000);
        assertEq(feed._bestAskPrice, 101000000);
        assertEq(feed._publisherCount, 5);
        assertEq(feed._exponent, -8);
        assertEq(feed._confidence, 50000);
        assertEq(feed._fundingRate, 123456);
        assertEq(feed._fundingTimestamp, 1234567890);
        assertEq(feed._fundingRateInterval, 3600);

        // Verify exists flags (all should be set)
        assertTrue(PythLazerLib.hasPrice(feed));
        assertTrue(PythLazerLib.hasBestBidPrice(feed));
        assertTrue(PythLazerLib.hasBestAskPrice(feed));
        assertTrue(PythLazerLib.hasPublisherCount(feed));
        assertTrue(PythLazerLib.hasExponent(feed));
        assertTrue(PythLazerLib.hasConfidence(feed));
        assertTrue(PythLazerLib.hasFundingRate(feed));
        assertTrue(PythLazerLib.hasFundingTimestamp(feed));
        assertTrue(PythLazerLib.hasFundingRateInterval(feed));
    }

    /// @notice Test parsing single feed with minimal properties
    function test_parseUpdate_singleFeed_minimalProperties() public pure {
        bytes[] memory properties = new bytes[](2);
        properties[0] = buildProperty(0, encodeInt64(50000000));
        properties[1] = buildProperty(4, encodeInt16(-6));

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(10, properties);

        bytes memory payload = buildPayload(
            1600000000,
            PythLazerStructs.Channel.FixedRate50,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        assertEq(update.feeds.length, 1);
        PythLazerStructs.Feed memory feed = update.feeds[0];

        assertEq(feed.feedId, 10);
        assertEq(feed._price, 50000000);
        assertEq(feed._exponent, -6);

        // Only price and exponent should exist
        assertTrue(PythLazerLib.hasPrice(feed));
        assertTrue(PythLazerLib.hasExponent(feed));
        assertFalse(PythLazerLib.hasBestBidPrice(feed));
        assertFalse(PythLazerLib.hasConfidence(feed));

        // Requested checks (tri-state applicability)
        assertTrue(PythLazerLib.isPriceRequested(feed));
        assertTrue(PythLazerLib.isExponentRequested(feed));
        assertFalse(PythLazerLib.isBestBidPriceRequested(feed));
        assertFalse(PythLazerLib.isBestAskPriceRequested(feed));
        assertFalse(PythLazerLib.isPublisherCountRequested(feed));
        assertFalse(PythLazerLib.isConfidenceRequested(feed));
        assertFalse(PythLazerLib.isFundingRateRequested(feed));
        assertFalse(PythLazerLib.isFundingTimestampRequested(feed));
        assertFalse(PythLazerLib.isFundingRateIntervalRequested(feed));
    }

    /// @notice Test parsing multiple feeds
    function test_parseUpdate_multipleFeeds() public pure {
        // Feed 1
        bytes[] memory props1 = new bytes[](5);
        props1[0] = buildProperty(0, encodeInt64(50000000000));
        props1[1] = buildProperty(3, encodeUint16(10));
        props1[2] = buildProperty(4, encodeInt16(-8));
        props1[3] = buildProperty(5, encodeInt64(10000000));
        props1[4] = buildProperty(1, encodeInt64(49900000000));

        // Feed 2
        bytes[] memory props2 = new bytes[](2);
        props2[0] = buildProperty(0, encodeInt64(3000000000));
        props2[1] = buildProperty(4, encodeInt16(-8));

        // Feed 3
        bytes[] memory props3 = new bytes[](3);
        props3[0] = buildProperty(0, encodeInt64(100000000));
        props3[1] = buildProperty(4, encodeInt16(-8));
        props3[2] = buildProperty(3, encodeUint16(7));

        bytes[] memory feeds = new bytes[](3);
        feeds[0] = buildFeedDataMulti(1, props1); // Feed 1
        feeds[1] = buildFeedDataMulti(2, props2); // Feed 2
        feeds[2] = buildFeedDataMulti(3, props3); // Feed 3

        bytes memory payload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        assertEq(update.feeds.length, 3);

        // Verify Feed 1
        assertEq(update.feeds[0].feedId, 1);
        assertEq(update.feeds[0]._price, 50000000000);
        assertTrue(PythLazerLib.hasConfidence(update.feeds[0]));
        // Requested checks for Feed 1 (props: price, publisherCount, exponent, confidence, bestBid)
        assertTrue(PythLazerLib.isPriceRequested(update.feeds[0]));
        assertTrue(PythLazerLib.isPublisherCountRequested(update.feeds[0]));
        assertTrue(PythLazerLib.isExponentRequested(update.feeds[0]));
        assertTrue(PythLazerLib.isConfidenceRequested(update.feeds[0]));
        assertTrue(PythLazerLib.isBestBidPriceRequested(update.feeds[0]));
        assertFalse(PythLazerLib.isBestAskPriceRequested(update.feeds[0]));
        assertFalse(PythLazerLib.isFundingRateRequested(update.feeds[0]));
        assertFalse(PythLazerLib.isFundingTimestampRequested(update.feeds[0]));
        assertFalse(
            PythLazerLib.isFundingRateIntervalRequested(update.feeds[0])
        );

        // Verify Feed 2
        assertEq(update.feeds[1].feedId, 2);
        assertEq(update.feeds[1]._price, 3000000000);
        assertFalse(PythLazerLib.hasConfidence(update.feeds[1]));
        // Requested checks for Feed 2 (props: price, exponent)
        assertTrue(PythLazerLib.isPriceRequested(update.feeds[1]));
        assertTrue(PythLazerLib.isExponentRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isBestBidPriceRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isBestAskPriceRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isPublisherCountRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isConfidenceRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isFundingRateRequested(update.feeds[1]));
        assertFalse(PythLazerLib.isFundingTimestampRequested(update.feeds[1]));
        assertFalse(
            PythLazerLib.isFundingRateIntervalRequested(update.feeds[1])
        );

        // Verify Feed 3
        assertEq(update.feeds[2].feedId, 3);
        assertEq(update.feeds[2]._price, 100000000);
        assertEq(update.feeds[2]._publisherCount, 7);
        // Requested checks for Feed 3 (props: price, exponent, publisherCount)
        assertTrue(PythLazerLib.isPriceRequested(update.feeds[2]));
        assertTrue(PythLazerLib.isExponentRequested(update.feeds[2]));
        assertTrue(PythLazerLib.isPublisherCountRequested(update.feeds[2]));
        assertFalse(PythLazerLib.isBestBidPriceRequested(update.feeds[2]));
        assertFalse(PythLazerLib.isBestAskPriceRequested(update.feeds[2]));
        assertFalse(PythLazerLib.isConfidenceRequested(update.feeds[2]));
        assertFalse(PythLazerLib.isFundingRateRequested(update.feeds[2]));
        assertFalse(PythLazerLib.isFundingTimestampRequested(update.feeds[2]));
        assertFalse(
            PythLazerLib.isFundingRateIntervalRequested(update.feeds[2])
        );
    }

    /// @notice Test when optional properties are zero
    function test_parseUpdate_optionalMissing_priceZero() public pure {
        bytes[] memory properties = new bytes[](3);
        properties[0] = buildProperty(0, encodeInt64(0));
        properties[1] = buildProperty(4, encodeInt16(-8));
        properties[2] = buildProperty(3, encodeUint16(3));

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(5, properties);

        bytes memory payload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        PythLazerStructs.Feed memory feed = update.feeds[0];

        assertEq(feed._price, 0);
        assertTrue(PythLazerLib.isPriceRequested(feed));
        assertFalse(PythLazerLib.hasPrice(feed));
        assertTrue(PythLazerLib.hasExponent(feed));
        assertTrue(PythLazerLib.hasPublisherCount(feed));
    }

    /// @notice Test confidence = 0
    function test_parseUpdate_optionalMissing_confidenceZero() public pure {
        bytes[] memory properties = new bytes[](3);
        properties[0] = buildProperty(0, encodeInt64(100000));
        properties[1] = buildProperty(4, encodeInt16(-6));
        properties[2] = buildProperty(5, encodeInt64(0));

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(7, properties);

        bytes memory payload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        PythLazerStructs.Feed memory feed = update.feeds[0];

        assertTrue(PythLazerLib.hasPrice(feed));
        assertTrue(PythLazerLib.isConfidenceRequested(feed));
        assertFalse(PythLazerLib.hasConfidence(feed));
        assertEq(feed._confidence, 0);
    }

    /// @notice Test negative values for signed fields
    function test_parseUpdate_negativeValues() public pure {
        bytes[] memory properties = new bytes[](3);
        properties[0] = buildProperty(0, encodeInt64(-50000000)); // negative price
        properties[1] = buildProperty(4, encodeInt16(-12)); // negative exponent
        properties[2] = buildProperty(6, encodeInt64(-999)); // negative funding rate

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(20, properties);

        bytes memory payload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        PythLazerStructs.Update memory update = PythLazerLib
            .parseUpdateFromPayload(payload);

        PythLazerStructs.Feed memory feed = update.feeds[0];

        assertEq(feed._price, -50000000);
        assertEq(feed._exponent, -12);
        assertEq(feed._fundingRate, -999);

        // Negative values should still count as "exists"
        assertTrue(PythLazerLib.hasPrice(feed));
        assertTrue(PythLazerLib.hasFundingRate(feed));
    }

    function test_parseUpdate_extraBytes() public {
        bytes[] memory properties = new bytes[](1);
        properties[0] = buildProperty(0, encodeInt64(100));

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(1, properties);

        bytes memory validPayload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        // Add extra bytes at the end
        bytes memory payloadWithExtra = bytes.concat(
            validPayload,
            hex"deadbeef"
        );

        vm.expectRevert("Payload has extra unknown bytes");
        PythLazerLib.parseUpdateFromPayload(payloadWithExtra);
    }

    /// @notice Test unknown property ID
    function test_parseUpdate_unknownProperty() public {
        // Build payload with invalid property ID (99)
        bytes memory invalidProperty = buildProperty(99, encodeInt64(100));

        bytes[] memory properties = new bytes[](1);
        properties[0] = invalidProperty;

        bytes[] memory feeds = new bytes[](1);
        feeds[0] = buildFeedDataMulti(1, properties);

        bytes memory payload = buildPayload(
            1700000000,
            PythLazerStructs.Channel.RealTime,
            feeds
        );

        vm.expectRevert("Unknown property");
        PythLazerLib.parseUpdateFromPayload(payload);
    }
}

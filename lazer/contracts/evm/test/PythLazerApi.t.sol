// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {PythLazerLib} from "../src/PythLazerLib.sol";
import {PythLazerStructs} from "../src/PythLazerStructs.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title PythLazerApiTest
 * @notice Integration test that calls the real Pyth Lazer API to verify parsing
 * @dev Requires running with: forge test --match-test test_parseApiResponse --ffi -vv
 */
contract PythLazerApiTest is Test {
    PythLazer public pythLazer;
    address owner;
    address trustedSigner = 0x26FB61A864c758AE9fBA027a96010480658385B9;
    uint256 trustedSignerExpiration = 3000000000000000;
    function setUp() public {
        owner = address(1);
        PythLazer pythLazerImpl = new PythLazer();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(pythLazerImpl),
            owner,
            abi.encodeWithSelector(PythLazer.initialize.selector, owner)
        );
        pythLazer = PythLazer(address(proxy));
        vm.prank(owner);
        pythLazer.updateTrustedSigner(trustedSigner, trustedSignerExpiration);
        assert(pythLazer.isValidSigner(trustedSigner));
    }
    
    /// @notice Test parsing real API response with two different feed types
    /// @dev Feed 3: Regular price feed (no funding rate properties)
    /// @dev Feed 112: Funding rate feed (no bid/ask properties)
    function test_parseApiResponse() public {
        // Call script to fetch full JSON response from API
        string[] memory inputs = new string[](2);
        inputs[0] = "bash";
        inputs[1] = "script/fetch_pyth_payload.sh";

        string memory jsonString = string(vm.ffi(inputs));
        
        // Extract Feed 3 reference values from API's parsed field (PYTH/USD)
        int64 apiRefFeed3Price = int64(uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[0].price")));
        int16 apiRefFeed3Exponent = int16(vm.parseJsonInt(jsonString, ".parsed.priceFeeds[0].exponent"));
        uint64 apiRefFeed3Confidence = uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[0].confidence"));
        uint16 apiRefFeed3PublisherCount = uint16(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[0].publisherCount"));
        int64 apiRefFeed3BestBid = int64(uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[0].bestBidPrice")));
        int64 apiRefFeed3BestAsk = int64(uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[0].bestAskPrice")));
        
        // Extract Feed 112 reference values from API's parsed field 
        int64 apiRefFeed112Price = int64(uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[1].price")));
        int16 apiRefFeed112Exponent = int16(vm.parseJsonInt(jsonString, ".parsed.priceFeeds[1].exponent"));
        uint16 apiRefFeed112PublisherCount = uint16(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[1].publisherCount"));
        int64 apiRefFeed112FundingRate = int64(vm.parseJsonInt(jsonString, ".parsed.priceFeeds[1].fundingRate"));
        uint64 apiRefFeed112FundingTimestamp = uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[1].fundingTimestamp"));
        uint64 apiRefFeed112FundingRateInterval = uint64(vm.parseJsonUint(jsonString, ".parsed.priceFeeds[1].fundingRateInterval"));

        bytes memory encodedUpdate = hexStringToBytes(vm.parseJsonString(jsonString, ".evm.data"));
        
        // Verify and extract payload
        (bytes memory payload, address signer) = pythLazer.verifyUpdate{value: pythLazer.verification_fee()}(encodedUpdate);
        assertEq(signer, trustedSigner, "Signer mismatch");
        
        // Parse the verified payload
        PythLazerStructs.Update memory parsedUpdate = PythLazerLib.parseUpdateFromPayload(payload);
        
        // Verify we got 2 feeds
        assertEq(parsedUpdate.feeds.length, 2, "Should have 2 feeds");
        
        // Find feeds by ID (order may vary)
        PythLazerStructs.Feed memory feed3;
        PythLazerStructs.Feed memory feed112;
        bool found3 = false;
        bool found112 = false;
        
        for (uint256 i = 0; i < parsedUpdate.feeds.length; i++) {
            if (parsedUpdate.feeds[i].feedId == 3) {
                feed3 = parsedUpdate.feeds[i];
                found3 = true;
            } else if (parsedUpdate.feeds[i].feedId == 112) {
                feed112 = parsedUpdate.feeds[i];
                found112 = true;
            }
        }
        
        assertTrue(found3, "Feed 3 not found");
        assertTrue(found112, "Feed 112 not found");
        
        // Validate Feed 3 (Regular Price Feed) - Compare against API reference
        assertEq(feed3.feedId, 3, "Feed 3: feedId mismatch");

        // Supported checks for Feed 3 (should be applicable for price/exponent/confidence/publisherCount/bid/ask; not applicable for funding*)
        assertTrue(PythLazerLib.isPriceSupported(feed3));
        assertTrue(PythLazerLib.isExponentSupported(feed3));
        assertTrue(PythLazerLib.isConfidenceSupported(feed3));
        assertTrue(PythLazerLib.isPublisherCountSupported(feed3));
        assertTrue(PythLazerLib.isBestBidPriceSupported(feed3));
        assertTrue(PythLazerLib.isBestAskPriceSupported(feed3));
        assertFalse(PythLazerLib.isFundingRateSupported(feed3));
        // assertFalse(PythLazerLib.isFundingTimestampSupported(feed3));
        // assertFalse(PythLazerLib.isFundingRateIntervalSupported(feed3));

                
        // Verify parsed values match API reference values exactly
        assertEq(PythLazerLib.getPrice(feed3), apiRefFeed3Price, "Feed 3: price mismatch");
        
        assertEq(PythLazerLib.getExponent(feed3), apiRefFeed3Exponent, "Feed 3: exponent mismatch");
        
        assertEq(PythLazerLib.getConfidence(feed3), apiRefFeed3Confidence, "Feed 3: confidence mismatch");
        
        assertEq(PythLazerLib.getPublisherCount(feed3), apiRefFeed3PublisherCount, "Feed 3: publisher count mismatch");
        
        assertEq(PythLazerLib.getBestBidPrice(feed3), apiRefFeed3BestBid, "Feed 3: best bid price mismatch");
        
        assertEq(PythLazerLib.getBestAskPrice(feed3), apiRefFeed3BestAsk, "Feed 3: best ask price mismatch");
        
        // Feed 3 should NOT have funding rate properties
        assertFalse(PythLazerLib.hasFundingRate(feed3), "Feed 3: should NOT have funding rate");
        assertFalse(PythLazerLib.hasFundingTimestamp(feed3), "Feed 3: should NOT have funding timestamp");
        assertFalse(PythLazerLib.hasFundingRateInterval(feed3), "Feed 3: should NOT have funding rate interval");


        
        // Validate Feed 112 (Funding Rate Feed) - Compare against API reference
        assertEq(feed112.feedId, 112, "Feed 112: feedId mismatch");

        // // Supported checks for Feed 112 (should be applicable for price/exponent/publisherCount/funding*; not applicable for bid/ask)
        // assertTrue(PythLazerLib.isPriceSupported(feed112));
        // assertTrue(PythLazerLib.isExponentSupported(feed112));
        // assertTrue(PythLazerLib.isPublisherCountSupported(feed112));
        // assertTrue(PythLazerLib.isFundingRateSupported(feed112));
        // assertTrue(PythLazerLib.isFundingTimestampSupported(feed112));
        // assertTrue(PythLazerLib.isFundingRateIntervalSupported(feed112));
        // assertFalse(PythLazerLib.isBestBidPriceSupported(feed112));
        // assertFalse(PythLazerLib.isBestAskPriceSupported(feed112));
        
        // Verify parsed values match API reference values exactly
        assertEq(PythLazerLib.getPrice(feed112), apiRefFeed112Price, "Feed 112: price mismatch");
        
        assertEq(PythLazerLib.getExponent(feed112), apiRefFeed112Exponent, "Feed 112: exponent mismatch");
        
        assertEq(PythLazerLib.getPublisherCount(feed112), apiRefFeed112PublisherCount, "Feed 112: publisher count mismatch");
        
        assertEq(PythLazerLib.getFundingRate(feed112), apiRefFeed112FundingRate, "Feed 112: funding rate mismatch");
        
        assertEq(PythLazerLib.getFundingTimestamp(feed112), apiRefFeed112FundingTimestamp, "Feed 112: funding timestamp mismatch");
        
        assertEq(PythLazerLib.getFundingRateInterval(feed112), apiRefFeed112FundingRateInterval, "Feed 112: funding rate interval mismatch");
        
        // Feed 112 should NOT have bid/ask prices
        assertFalse(PythLazerLib.hasBestBidPrice(feed112), "Feed 112: should NOT have best bid price");
        assertFalse(PythLazerLib.hasBestAskPrice(feed112), "Feed 112: should NOT have best ask price");

    }
    
    /// @notice Convert hex string to bytes (handles 0x prefix)
    function hexStringToBytes(string memory hexStr) internal pure returns (bytes memory) {
        bytes memory hexBytes = bytes(hexStr);
        uint256 startIndex = 0;
        
        uint256 length = hexBytes.length - startIndex;
        
        // Hex string should have even length
        require(length % 2 == 0, "Invalid hex string length");
        
        bytes memory result = new bytes(length / 2);
        for (uint256 i = 0; i < length / 2; i++) {
            result[i] = bytes1(
                (hexCharToUint8(hexBytes[startIndex + 2 * i]) << 4) |
                hexCharToUint8(hexBytes[startIndex + 2 * i + 1])
            );
        }
        
        return result;
    }
    
    /// @notice Convert hex character to uint8
    function hexCharToUint8(bytes1 char) internal pure returns (uint8) {
        uint8 byteValue = uint8(char);
        if (byteValue >= uint8(bytes1('0')) && byteValue <= uint8(bytes1('9'))) {
            return byteValue - uint8(bytes1('0'));
        } else if (byteValue >= uint8(bytes1('a')) && byteValue <= uint8(bytes1('f'))) {
            return 10 + byteValue - uint8(bytes1('a'));
        } else if (byteValue >= uint8(bytes1('A')) && byteValue <= uint8(bytes1('F'))) {
            return 10 + byteValue - uint8(bytes1('A'));
        }
        revert("Invalid hex character");
    }
}

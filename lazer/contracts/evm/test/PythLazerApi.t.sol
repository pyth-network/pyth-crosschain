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

    /// @notice Test parsing real API response for Feed 3 (regular price feed)
    /// @dev Feed 3: Regular price feed (no funding rate properties requested)
    function test_parseApiResponse_feed3() public {
        // Call script to fetch combined JSON response from API (two separate calls)
        string[] memory inputs = new string[](2);
        inputs[0] = "bash";
        inputs[1] = "script/fetch_pyth_payload.sh";

        string memory jsonString = string(vm.ffi(inputs));

        // Extract Feed 3 binary and reference values
        string memory feed3BinaryHex = vm.parseJsonString(
            jsonString,
            ".feed3.evm.data"
        );
        bytes memory encodedUpdateFeed3 = hexStringToBytes(feed3BinaryHex);
        int64 apiRefFeed3Price = int64(
            uint64(
                vm.parseJsonUint(
                    jsonString,
                    ".feed3.parsed.priceFeeds[0].price"
                )
            )
        );
        int16 apiRefFeed3Exponent = int16(
            vm.parseJsonInt(jsonString, ".feed3.parsed.priceFeeds[0].exponent")
        );
        uint64 apiRefFeed3Confidence = uint64(
            vm.parseJsonUint(
                jsonString,
                ".feed3.parsed.priceFeeds[0].confidence"
            )
        );
        uint16 apiRefFeed3PublisherCount = uint16(
            vm.parseJsonUint(
                jsonString,
                ".feed3.parsed.priceFeeds[0].publisherCount"
            )
        );
        int64 apiRefFeed3BestBid = int64(
            uint64(
                vm.parseJsonUint(
                    jsonString,
                    ".feed3.parsed.priceFeeds[0].bestBidPrice"
                )
            )
        );
        int64 apiRefFeed3BestAsk = int64(
            uint64(
                vm.parseJsonUint(
                    jsonString,
                    ".feed3.parsed.priceFeeds[0].bestAskPrice"
                )
            )
        );

        // Verify and parse Feed 3
        (bytes memory payloadFeed3, address signerFeed3) = pythLazer
            .verifyUpdate{value: pythLazer.verification_fee()}(
            encodedUpdateFeed3
        );
        assertEq(signerFeed3, trustedSigner, "Feed 3: Signer mismatch");

        PythLazerStructs.Update memory updateFeed3 = PythLazerLib
            .parseUpdateFromPayload(payloadFeed3);
        assertEq(
            updateFeed3.feeds.length,
            1,
            "Feed 3 update should have 1 feed"
        );
        PythLazerStructs.Feed memory feed3 = updateFeed3.feeds[0];

        // Validate Feed 3 (Regular Price Feed) - Compare against API reference
        assertEq(feed3.feedId, 3, "Feed 3: feedId mismatch");

        // Requested checks for Feed 3 (should be requested for price/exponent/confidence/publisherCount/bid/ask; not requested for funding*)
        assertTrue(
            PythLazerLib.isPriceRequested(feed3),
            "Feed 3: price should be requested"
        );
        assertTrue(
            PythLazerLib.isExponentRequested(feed3),
            "Feed 3: exponent should be requested"
        );
        assertTrue(
            PythLazerLib.isConfidenceRequested(feed3),
            "Feed 3: confidence should be requested"
        );
        assertTrue(
            PythLazerLib.isPublisherCountRequested(feed3),
            "Feed 3: publisher count should be requested"
        );
        assertTrue(
            PythLazerLib.isBestBidPriceRequested(feed3),
            "Feed 3: best bid price should be requested"
        );
        assertTrue(
            PythLazerLib.isBestAskPriceRequested(feed3),
            "Feed 3: best ask price should be requested"
        );
        assertFalse(
            PythLazerLib.isFundingRateRequested(feed3),
            "Feed 3: funding rate should NOT be requested"
        );
        assertFalse(
            PythLazerLib.isFundingTimestampRequested(feed3),
            "Feed 3: funding timestamp should NOT be requested"
        );
        assertFalse(
            PythLazerLib.isFundingRateIntervalRequested(feed3),
            "Feed 3: funding rate interval should NOT be requested"
        );

        // Verify parsed values match API reference values exactly
        assertEq(
            PythLazerLib.getPrice(feed3),
            apiRefFeed3Price,
            "Feed 3: price mismatch"
        );
        assertEq(
            PythLazerLib.getExponent(feed3),
            apiRefFeed3Exponent,
            "Feed 3: exponent mismatch"
        );
        assertEq(
            PythLazerLib.getConfidence(feed3),
            apiRefFeed3Confidence,
            "Feed 3: confidence mismatch"
        );
        assertEq(
            PythLazerLib.getPublisherCount(feed3),
            apiRefFeed3PublisherCount,
            "Feed 3: publisher count mismatch"
        );
        assertEq(
            PythLazerLib.getBestBidPrice(feed3),
            apiRefFeed3BestBid,
            "Feed 3: best bid price mismatch"
        );
        assertEq(
            PythLazerLib.getBestAskPrice(feed3),
            apiRefFeed3BestAsk,
            "Feed 3: best ask price mismatch"
        );
    }

    /// @notice Test parsing real API response for Feed 112 (funding rate feed)
    /// @dev Feed 112: Funding rate feed (no bid/ask/confidence properties requested)
    function test_parseApiResponse_feed112() public {
        // Call script to fetch combined JSON response from API
        string[] memory inputs = new string[](2);
        inputs[0] = "bash";
        inputs[1] = "script/fetch_pyth_payload.sh";

        string memory jsonString = string(vm.ffi(inputs));

        // Extract Feed 112 binary and reference values
        string memory feed112BinaryHex = vm.parseJsonString(
            jsonString,
            ".feed112.evm.data"
        );
        bytes memory encodedUpdateFeed112 = hexStringToBytes(feed112BinaryHex);
        int64 apiRefFeed112Price = int64(
            uint64(
                vm.parseJsonUint(
                    jsonString,
                    ".feed112.parsed.priceFeeds[0].price"
                )
            )
        );
        int16 apiRefFeed112Exponent = int16(
            vm.parseJsonInt(
                jsonString,
                ".feed112.parsed.priceFeeds[0].exponent"
            )
        );
        uint16 apiRefFeed112PublisherCount = uint16(
            vm.parseJsonUint(
                jsonString,
                ".feed112.parsed.priceFeeds[0].publisherCount"
            )
        );
        int64 apiRefFeed112FundingRate = int64(
            vm.parseJsonInt(
                jsonString,
                ".feed112.parsed.priceFeeds[0].fundingRate"
            )
        );
        uint64 apiRefFeed112FundingTimestamp = uint64(
            vm.parseJsonUint(
                jsonString,
                ".feed112.parsed.priceFeeds[0].fundingTimestamp"
            )
        );
        uint64 apiRefFeed112FundingRateInterval = uint64(
            vm.parseJsonUint(
                jsonString,
                ".feed112.parsed.priceFeeds[0].fundingRateInterval"
            )
        );

        // Verify and parse Feed 112
        (bytes memory payloadFeed112, address signerFeed112) = pythLazer
            .verifyUpdate{value: pythLazer.verification_fee()}(
            encodedUpdateFeed112
        );
        assertEq(signerFeed112, trustedSigner, "Feed 112: Signer mismatch");

        PythLazerStructs.Update memory updateFeed112 = PythLazerLib
            .parseUpdateFromPayload(payloadFeed112);
        assertEq(
            updateFeed112.feeds.length,
            1,
            "Feed 112 update should have 1 feed"
        );
        PythLazerStructs.Feed memory feed112 = updateFeed112.feeds[0];

        // Validate Feed 112 (Funding Rate Feed) - Compare against API reference
        assertEq(feed112.feedId, 112, "Feed 112: feedId mismatch");

        // Requested checks for Feed 112 (should be requested for price/exponent/publisherCount/funding*; not requested for bid/ask/confidence)
        assertTrue(
            PythLazerLib.isPriceRequested(feed112),
            "Feed 112: price should be requested"
        );
        assertTrue(
            PythLazerLib.isExponentRequested(feed112),
            "Feed 112: exponent should be requested"
        );
        assertTrue(
            PythLazerLib.isPublisherCountRequested(feed112),
            "Feed 112: publisher count should be requested"
        );
        assertTrue(
            PythLazerLib.isFundingRateRequested(feed112),
            "Feed 112: funding rate should be requested"
        );
        assertTrue(
            PythLazerLib.isFundingTimestampRequested(feed112),
            "Feed 112: funding timestamp should be requested"
        );
        assertTrue(
            PythLazerLib.isFundingRateIntervalRequested(feed112),
            "Feed 112: funding rate interval should be requested"
        );
        assertFalse(
            PythLazerLib.isBestBidPriceRequested(feed112),
            "Feed 112: best bid price should NOT be requested"
        );
        assertFalse(
            PythLazerLib.isBestAskPriceRequested(feed112),
            "Feed 112: best ask price should NOT be requested"
        );
        assertFalse(
            PythLazerLib.isConfidenceRequested(feed112),
            "Feed 112: confidence should NOT be requested"
        );

        // Verify parsed values match API reference values exactly
        assertEq(
            PythLazerLib.getPrice(feed112),
            apiRefFeed112Price,
            "Feed 112: price mismatch"
        );

        assertEq(
            PythLazerLib.getExponent(feed112),
            apiRefFeed112Exponent,
            "Feed 112: exponent mismatch"
        );

        assertEq(
            PythLazerLib.getPublisherCount(feed112),
            apiRefFeed112PublisherCount,
            "Feed 112: publisher count mismatch"
        );

        assertEq(
            PythLazerLib.getFundingRate(feed112),
            apiRefFeed112FundingRate,
            "Feed 112: funding rate mismatch"
        );

        assertEq(
            PythLazerLib.getFundingTimestamp(feed112),
            apiRefFeed112FundingTimestamp,
            "Feed 112: funding timestamp mismatch"
        );

        assertEq(
            PythLazerLib.getFundingRateInterval(feed112),
            apiRefFeed112FundingRateInterval,
            "Feed 112: funding rate interval mismatch"
        );
    }

    /// @notice Convert hex string to bytes (handles 0x prefix)
    function hexStringToBytes(
        string memory hexStr
    ) internal pure returns (bytes memory) {
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
        if (
            byteValue >= uint8(bytes1("0")) && byteValue <= uint8(bytes1("9"))
        ) {
            return byteValue - uint8(bytes1("0"));
        } else if (
            byteValue >= uint8(bytes1("a")) && byteValue <= uint8(bytes1("f"))
        ) {
            return 10 + byteValue - uint8(bytes1("a"));
        } else if (
            byteValue >= uint8(bytes1("A")) && byteValue <= uint8(bytes1("F"))
        ) {
            return 10 + byteValue - uint8(bytes1("A"));
        }
        revert("Invalid hex character");
    }
}

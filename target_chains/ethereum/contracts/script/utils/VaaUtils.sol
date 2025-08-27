// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

library VaaUtils {
    /**
     * @dev Assert that a VAA has the expected payload
     * @param vaaBytes The VAA bytes to check
     * @param expectedPayload The expected payload bytes
     */
    function assertVaaPayloadEquals(
        bytes memory vaaBytes,
        bytes memory expectedPayload
    ) internal pure {
        // VAA structure: version (1) + guardianSetIndex (4) + signaturesLength (1) + signatures + body
        // Body structure: timestamp (4) + nonce (4) + emitterChainId (2) + emitterAddress (32) + sequence (8) + consistencyLevel (1) + payload

        require(vaaBytes.length >= 51, "VAA too short"); // Minimum VAA length

        uint256 offset = 6; // Skip version (1) + guardianSetIndex (4) + signaturesLength (1)

        // Skip signatures (each signature is 66 bytes: guardianIndex (1) + r (32) + s (32) + v (1))
        uint8 signaturesLength = uint8(vaaBytes[5]);
        offset += signaturesLength * 66;

        // Skip to payload (skip timestamp (4) + nonce (4) + emitterChainId (2) + emitterAddress (32) + sequence (8) + consistencyLevel (1))
        offset += 51;

        require(offset < vaaBytes.length, "Invalid VAA structure");

        // Extract payload
        bytes memory actualPayload = new bytes(vaaBytes.length - offset);
        for (uint256 i = 0; i < actualPayload.length; i++) {
            actualPayload[i] = vaaBytes[offset + i];
        }

        require(
            keccak256(actualPayload) == keccak256(expectedPayload),
            "VAA payload does not match expected payload"
        );
    }

    /**
     * @dev Extract payload from VAA bytes
     * @param vaaBytes The VAA bytes
     * @return payload The extracted payload
     */
    function extractPayload(
        bytes memory vaaBytes
    ) internal pure returns (bytes memory payload) {
        require(vaaBytes.length >= 51, "VAA too short");

        uint256 offset = 6; // Skip version (1) + guardianSetIndex (4) + signaturesLength (1)

        // Skip signatures
        uint8 signaturesLength = uint8(vaaBytes[5]);
        offset += signaturesLength * 66;

        // Skip to payload
        offset += 51;

        require(offset < vaaBytes.length, "Invalid VAA structure");

        payload = new bytes(vaaBytes.length - offset);
        for (uint256 i = 0; i < payload.length; i++) {
            payload[i] = vaaBytes[offset + i];
        }
    }
}

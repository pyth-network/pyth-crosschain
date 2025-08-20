// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract CreateLocalnetGovernanceVaaScript is Script {
    // Test signer private key (same as in the JS version)
    uint256 constant TEST_SIGNER_PK =
        0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;

    uint16 constant TEST_GOVERNANCE_CHAIN = 1; // ethereum
    bytes32 constant TEST_GOVERNANCE_EMITTER =
        0x0000000000000000000000000000000000000000000000000000000000001234;

    function run() external view {
        uint32 timestamp = uint32(
            vm.envOr("TIMESTAMP", uint256(block.timestamp))
        );
        uint32 nonce = uint32(vm.envOr("NONCE", uint256(0)));
        uint16 emitterChainId = uint16(
            vm.envOr("EMITTER_CHAIN_ID", uint256(TEST_GOVERNANCE_CHAIN))
        );
        bytes32 emitterAddress = vm.envOr(
            "EMITTER_ADDRESS",
            TEST_GOVERNANCE_EMITTER
        );
        uint64 sequence = uint64(vm.envOr("SEQUENCE", uint256(0)));
        bytes memory data = vm.envBytes("GOVERNANCE_DATA");
        uint32 guardianSetIndex = uint32(
            vm.envOr("GUARDIAN_SET_INDEX", uint256(0))
        );
        uint8 consistencyLevel = uint8(
            vm.envOr("CONSISTENCY_LEVEL", uint256(32))
        );

        console.log("Creating localnet governance VAA with parameters:");
        console.log("Timestamp:", timestamp);
        console.log("Nonce:", nonce);
        console.log("Emitter Chain ID:", emitterChainId);
        console.log("Emitter Address:", uint256(emitterAddress));
        console.log("Sequence:", sequence);
        console.log("Guardian Set Index:", guardianSetIndex);
        console.log("Consistency Level:", consistencyLevel);
        console.log("Data length:", data.length);

        // Create VAA body
        bytes memory body = abi.encodePacked(
            timestamp,
            nonce,
            emitterChainId,
            emitterAddress,
            sequence,
            consistencyLevel,
            data
        );

        // Hash the body for signing
        bytes32 bodyHash = keccak256(abi.encodePacked(keccak256(body)));

        // Sign with test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TEST_SIGNER_PK, bodyHash);

        // Create signature structure (guardian index 0, signature)
        bytes memory signature = abi.encodePacked(uint8(0), r, s, v);

        // Create complete VAA
        bytes memory vaa = abi.encodePacked(
            uint8(1), // version
            guardianSetIndex, // guardian set index
            uint8(1), // number of signatures
            signature, // signatures
            body // body
        );

        console.log("Generated VAA (hex):");
        console.logBytes(vaa);

        // Also log as a string for easy copying
        string memory vaaHex = vm.toString(vaa);
        console.log("VAA hex string:", vaaHex);
    }
}

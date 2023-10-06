// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";
import "../contracts/random/PythRandom.sol";
import "../contracts/libraries/MerkleTree.sol";

contract PythRandomTest is Test, RandTestUtils {
    PythRandom public random;

    uint pythFeeInWei = 7;

    address public providerOne = address(1);
    bytes[] providerOneProofs;
    uint providerOneFeeInWei = 8;

    address public providerTwo = address(2);
    bytes[] providerTwoProofs;
    uint providerTwoFeeInWei = 20;

    address public user = address(3);

    function setUp() public {
        random = new PythRandom();
        random.initialize(7);

        (bytes20 rootDigest, bytes[] memory proofs1) = generateMerkleTree(providerOne, 0, 100);
        providerOneProofs = proofs1;
        vm.prank(providerOne);
        random.register(providerOneFeeInWei, rootDigest, bytes32(keccak256(abi.encodePacked(uint256(0x0100)))), 100);

        (bytes20 providerTwoRoot, bytes[] memory proofs2) = generateMerkleTree(providerTwo, 0, 100);
        providerTwoProofs = proofs2;
        vm.prank(providerTwo);
        random.register(providerTwoFeeInWei, providerTwoRoot, bytes32(keccak256(abi.encodePacked(uint256(0x0200)))), 100);
    }

    function sequenceNumberToRandomValue(address provider, uint64 sequenceNumber) public view returns (uint256 result) {
        result = uint256(sequenceNumber) + 1 + uint256(keccak256(abi.encodePacked(provider)));
    }

    function packLeaf(uint64 sequenceNumber, uint256 random) public view returns (bytes memory packedData) {
        packedData = new bytes(40); // 8 bytes for uint64 + 32 bytes for uint256

        // Convert uint64 to bytes
        bytes8 bytesX = bytes8(uint64(sequenceNumber));
        // Convert uint256 to bytes
        bytes32 bytesY = bytes32(random);

        // Copy the bytes of x and y into packedData
        for (uint256 i = 0; i < 8; i++) {
            packedData[i] = bytesX[i];
        }
        for (uint256 i = 0; i < 32; i++) {
            packedData[i + 8] = bytesY[i];
        }
    }

    function packProof(bytes memory proof, uint64 sequenceNumber, uint256 randomValue) public view returns (bytes memory packedData) {
        bytes memory leaf = packLeaf(sequenceNumber, randomValue);

        packedData = new bytes(leaf.length + proof.length);
        for (uint256 i = 0; i < leaf.length; i++) {
            packedData[i] = leaf[i];
        }
        for (uint256 i = 0; i < proof.length; i++) {
            packedData[i + leaf.length] = proof[i];
        }
    }

    function generateMerkleTree(address provider, uint64 startSequenceNumber, uint64 size) public view returns (bytes20 rootDigest, bytes[] memory proofs) {
        bytes[] memory messages = new bytes[](size);
        for (uint64 i = 0; i < size; i++) {
            // TODO: actual random numbers
            uint64 sequenceNumber = startSequenceNumber + i;
            messages[i] = packLeaf(sequenceNumber, sequenceNumberToRandomValue(provider, sequenceNumber));
        }

        // TODO: fix depth
        (rootDigest, proofs) = MerkleTree.constructProofs(messages, 10);
    }

    function testBasic() public {
        uint256 userRandom = 42;
        bytes32 commitment = random.constructUserCommitment(userRandom);

        vm.deal(user, 100000);
        vm.prank(user);
        (uint64 sequenceNumber, bytes32 identifier) = random.requestRandomNumber{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment);

        bytes memory proof = packProof(providerOneProofs[sequenceNumber], sequenceNumber, sequenceNumberToRandomValue(providerOne, sequenceNumber));

        vm.prank(user);
        uint256 randomNumber = random.fulfillRequest(providerOne, sequenceNumber, userRandom, proof);

        assertEq(randomNumber, random.combineRandomValues(userRandom, sequenceNumberToRandomValue(providerOne, sequenceNumber)));

    }
}

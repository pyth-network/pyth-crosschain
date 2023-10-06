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

    address public user = address(3);

    function setUp() public {
        random = new PythRandom();
        random.initialize(7);

        (bytes20 rootDigest, bytes[] memory proofs) = generateMerkleTree(0, 100);
        providerOneProofs = proofs;

        vm.prank(providerOne);
        random.register(providerOneFeeInWei, rootDigest, 100);
    }

    // TODO: provider
    function sequenceNumberToRandomValue(uint64 sequenceNumber) public view returns (uint256 result) {
        result = uint256(sequenceNumber) + 1;
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

    function getIthProof(bytes[] memory proofs, uint64 i) public view returns (bytes memory packedData) {
        bytes memory proof = proofs[i];
        bytes memory leaf = packLeaf(i, sequenceNumberToRandomValue(i));

        packedData = new bytes(40 + proof.length); // 8 bytes for uint64 + 32 bytes for uint256

        // FIXME: extract constant for 40
        // Copy the bytes of x and y into packedData
        for (uint256 i = 0; i < 40; i++) {
            packedData[i] = leaf[i];
        }
        for (uint256 i = 0; i < proof.length; i++) {
            packedData[i + 40] = proof[i];
        }

    }

    function generateMerkleTree(uint64 startSequenceNumber, uint64 size) public view returns (bytes20 rootDigest, bytes[] memory proofs) {
        bytes[] memory messages = new bytes[](size);
        for (uint64 i = 0; i < size; i++) {
            // TODO: actual random numbers
            uint64 sequenceNumber = startSequenceNumber + i;
            messages[i] = packLeaf(sequenceNumber, sequenceNumberToRandomValue(sequenceNumber));
        }

        // TODO: fix depth
        (rootDigest, proofs) = MerkleTree.constructProofs(messages, 10);
    }

    function testBasic() public {
        uint256 userRandom = 42;
        bytes32 commitment = random.constructUserCommitment(userRandom);

        vm.deal(user, 100000);
        vm.prank(user);
        uint64 sequenceNumber = random.requestRandomNumber{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment);

        console.log(sequenceNumber);

        bytes memory proof = getIthProof(providerOneProofs,sequenceNumber);
        console.log(vm.toString(proof));

        vm.prank(user);
        uint256 randomNumber = random.fulfillRequest(providerOne, sequenceNumber, userRandom, proof);

        assertEq(randomNumber, random.combineRandomValues(userRandom, sequenceNumberToRandomValue(sequenceNumber)));

    }
}

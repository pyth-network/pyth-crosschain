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

contract PythRandomTest is Test, RandTestUtils {
    PythRandom public random;

    uint pythFeeInWei = 7;

    address public providerOne = address(1);
    bytes32[] providerOneProofs;
    uint providerOneFeeInWei = 8;

    address public providerTwo = address(2);
    bytes32[] providerTwoProofs;
    uint providerTwoFeeInWei = 20;

    address public user = address(3);

    function setUp() public {
        random = new PythRandom();
        random.initialize(7);

        bytes32[] memory hashChain1 = generateHashChain(providerOne, 0, 100);
        providerOneProofs = hashChain1;
        vm.prank(providerOne);
        random.register(providerOneFeeInWei, providerOneProofs[0], bytes32(keccak256(abi.encodePacked(uint256(0x0100)))), 100);

        bytes32[] memory hashChain2 = generateHashChain(providerTwo, 0, 100);
        providerTwoProofs = hashChain2;
        vm.prank(providerTwo);
        random.register(providerTwoFeeInWei, providerTwoProofs[0], bytes32(keccak256(abi.encodePacked(uint256(0x0200)))), 100);
    }

    function generateHashChain(address provider, uint64 startSequenceNumber, uint64 size) public view returns (bytes32[] memory hashChain) {
        bytes32 initialValue = keccak256(abi.encodePacked(startSequenceNumber));
        hashChain = new bytes32[](size);
        for (uint64 i = 0; i < size; i++) {
            hashChain[size - (i + 1)] = initialValue;
            initialValue = keccak256(bytes.concat(initialValue));
        }
    }

    function assertRevealSucceeds(address provider, uint64 sequenceNumber, bytes32 userRandom, bytes32 providerRevelation) public {
        bytes32 randomNumber = random.reveal(providerOne, sequenceNumber, userRandom, providerRevelation);
        assertEq(randomNumber, random.combineRandomValues(userRandom, providerRevelation, bytes32(uint256(0))));
    }

    function assertRevealReverts(address provider, uint64 sequenceNumber, bytes32 userRandom, bytes32 providerRevelation) public {
        vm.expectRevert();
        random.reveal(providerOne, sequenceNumber, userRandom, providerRevelation);
    }

    function testBasic() public {
        bytes32 userRandom = bytes32(uint256(42));
        bytes32 commitment = random.constructUserCommitment(userRandom);

        vm.deal(user, 100000);
        vm.prank(user);
        uint64 sequenceNumber = random.request{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment, false);

        assertRevealSucceeds(providerOne, sequenceNumber, userRandom, providerOneProofs[sequenceNumber]);

        // You can only reveal the random number once. This isn't a feature of the contract per se, but it is
        // the expected behavior.
        assertRevealReverts(providerOne, sequenceNumber, userRandom, providerOneProofs[sequenceNumber]);
    }

    function testRotate() public {
        bytes32 userRandom = bytes32(uint256(42));
        bytes32 commitment = random.constructUserCommitment(userRandom);

        vm.deal(user, 100000000);
        vm.prank(user);
        uint64 sequenceNumber1 = random.request{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment, false);

        vm.prank(user);
        uint64 sequenceNumber2 = random.request{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment, false);
        assertEq(sequenceNumber2, sequenceNumber1 + 1);

        uint64 newHashChainOffset = sequenceNumber2 + 1;
        bytes32[] memory newHashChain = generateHashChain(providerOne, newHashChainOffset, 10);
        vm.prank(providerOne);
        random.register(providerOneFeeInWei, newHashChain[0], bytes32(keccak256(abi.encodePacked(uint256(0x0100)))), newHashChainOffset + 10);

        vm.prank(user);
        uint64 sequenceNumber3 = random.request{value: pythFeeInWei + providerOneFeeInWei}(providerOne, commitment, false);
        // Rotating the provider key uses a sequence number
        assertEq(sequenceNumber3, sequenceNumber2 + 2);

        // Requests that were in-flight at the time of rotation use the commitment from the time of request
        for (uint256 i = 0; i < 10; i++) {
            assertRevealReverts(providerOne, sequenceNumber1, userRandom, newHashChain[i]);
        }
        assertRevealSucceeds(providerOne, sequenceNumber1, userRandom, providerOneProofs[sequenceNumber1]);

        // Requests after the rotation use the new commitment
        assertRevealReverts(providerOne, sequenceNumber3, userRandom, providerOneProofs[sequenceNumber3]);
        assertRevealSucceeds(providerOne, sequenceNumber3, userRandom, newHashChain[sequenceNumber3 - newHashChainOffset]);
    }

    // TODO
    // - fee arithmetic overflows revert
    // - multiple concurrent requests
    // - what's the impact of # of in-flight requests on gas usage?
    // - fee accounting, withdrawal, and getFee
    // - fee payment is required
    // - what happens if you run out of randomness
    // - test all reverts
}

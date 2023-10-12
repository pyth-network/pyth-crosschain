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

    address public provider1 = address(1);
    bytes32[] provider1Proofs;
    uint provider1FeeInWei = 8;
    uint64 provider1ChainLength = 100;

    address public provider2 = address(2);
    bytes32[] provider2Proofs;
    uint provider2FeeInWei = 20;

    address public user1 = address(3);
    address public user2 = address(4);

    address public unregisteredProvider = address(7);
    uint256 MAX_UINT256 = 2**256 - 1;

    function setUp() public {
        random = new PythRandom();
        random.initialize(7);

        bytes32[] memory hashChain1 = generateHashChain(provider1, 0, provider1ChainLength);
        provider1Proofs = hashChain1;
        vm.prank(provider1);
        random.register(
            provider1FeeInWei,
            provider1Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            provider1ChainLength
        );

        bytes32[] memory hashChain2 = generateHashChain(provider2, 0, 100);
        provider2Proofs = hashChain2;
        vm.prank(provider2);
        random.register(
            provider2FeeInWei,
            provider2Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0200)))),
            100
        );
    }

    function generateHashChain(
        address provider,
        uint64 startSequenceNumber,
        uint64 size
    ) public view returns (bytes32[] memory hashChain) {
        bytes32 initialValue = keccak256(abi.encodePacked(startSequenceNumber));
        hashChain = new bytes32[](size);
        for (uint64 i = 0; i < size; i++) {
            hashChain[size - (i + 1)] = initialValue;
            initialValue = keccak256(bytes.concat(initialValue));
        }
    }

    // Test helper method for requesting a random value as user from provider.
    function request(address user, address provider, uint randomNumber, bool useBlockhash) public returns (uint64 sequenceNumber) {
        sequenceNumber = requestWithFee(user, random.getFee(provider), provider, randomNumber, useBlockhash);
    }

    function requestWithFee(address user, uint fee, address provider, uint randomNumber, bool useBlockhash) public returns (uint64 sequenceNumber) {
        vm.deal(user, fee);
        vm.prank(user);
        sequenceNumber = random.request{
        value: fee
        }(provider, random.constructUserCommitment(bytes32(randomNumber)), useBlockhash);
    }

    function assertRequestReverts(address user, uint fee, address provider, uint randomNumber, bool useBlockhash) public {
        vm.deal(user, fee);
        vm.expectRevert();
        vm.prank(user);
        uint64 sequenceNumber = random.request{
        value: fee
        }(provider, random.constructUserCommitment(bytes32(randomNumber)), useBlockhash);
    }

    function assertRevealSucceeds(
        address provider,
        uint64 sequenceNumber,
        uint userRandom,
        bytes32 providerRevelation
    ) public {
        bytes32 randomNumber = random.reveal(
            provider,
            sequenceNumber,
            bytes32(userRandom),
            providerRevelation
        );
        assertEq(
            randomNumber,
            random.combineRandomValues(
                bytes32(userRandom),
                providerRevelation,
                bytes32(uint256(0))
            )
        );
    }

    function assertRevealReverts(
        address provider,
        uint64 sequenceNumber,
        uint userRandom,
        bytes32 providerRevelation
    ) public {
        vm.expectRevert();
        random.reveal(
            provider,
            sequenceNumber,
            bytes32(uint256(userRandom)),
            providerRevelation
        );
    }

    function assertInvariants() public {
        uint expectedBalance = random.getProviderInfo(provider1).accruedFeesInWei + random.getProviderInfo(provider2).accruedFeesInWei + random.getAccruedPythFees();
        assertEq(address(random).balance, expectedBalance);

        PythRandomStructs.ProviderInfo memory info1 = random.getProviderInfo(provider1);
        assert(info1.currentCommitmentSequenceNumber < info1.sequenceNumber);
        assert(info1.sequenceNumber <= info1.endSequenceNumber);
        PythRandomStructs.ProviderInfo memory info2 = random.getProviderInfo(provider2);
        assert(info2.sequenceNumber > info2.currentCommitmentSequenceNumber);
        assert(info2.sequenceNumber <= info2.endSequenceNumber);
    }

    function testBasic() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);

        assertRevealSucceeds(
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );

        // You can only reveal the random number once. This isn't a feature of the contract per se, but it is
        // the expected behavior.
        assertRevealReverts(
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );
    }

    function testConcurrent() public {
        uint64 s1 = request(user1, provider1, 1, false);
        uint64 s2 = request(user2, provider1, 2, false);
        uint64 s3 = request(user1, provider1, 3, false);
        uint64 s4 = request(user1, provider1, 4, false);

        assertRevealSucceeds(
            provider1,
            s3,
            3,
            provider1Proofs[s3]
        );

        uint64 s5 = request(user1, provider1, 5, false);

        assertRevealSucceeds(
            provider1,
            s4,
            4,
            provider1Proofs[s4]
        );

        assertRevealSucceeds(
            provider1,
            s1,
            1,
            provider1Proofs[s1]
        );

        assertRevealSucceeds(
            provider1,
            s2,
            2,
            provider1Proofs[s2]
        );

        assertRevealSucceeds(
            provider1,
            s5,
            5,
            provider1Proofs[s5]
        );
    }

    function testRotate() public {
        uint userRandom = 42;
        uint64 sequenceNumber1 = request(user2, provider1, userRandom, false);
        uint64 sequenceNumber2 = request(user2, provider1, userRandom, false);

        uint64 newHashChainOffset = sequenceNumber2 + 1;
        bytes32[] memory newHashChain = generateHashChain(
            provider1,
            newHashChainOffset,
            10
        );
        vm.prank(provider1);
        random.register(
            provider1FeeInWei,
            newHashChain[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            newHashChainOffset + 10
        );

        uint64 sequenceNumber3 = request(user2, provider1, 42, false);
        // Rotating the provider key uses a sequence number
        assertEq(sequenceNumber3, sequenceNumber2 + 2);

        // Requests that were in-flight at the time of rotation use the commitment from the time of request
        for (uint256 i = 0; i < 10; i++) {
            assertRevealReverts(
                provider1,
                sequenceNumber1,
                userRandom,
                newHashChain[i]
            );
        }
        assertRevealSucceeds(
            provider1,
            sequenceNumber1,
            userRandom,
            provider1Proofs[sequenceNumber1]
        );

        // Requests after the rotation use the new commitment
        assertRevealReverts(
            provider1,
            sequenceNumber3,
            userRandom,
            provider1Proofs[sequenceNumber3]
        );
        assertRevealSucceeds(
            provider1,
            sequenceNumber3,
            userRandom,
            newHashChain[sequenceNumber3 - newHashChainOffset]
        );
    }

    function testOutOfRandomness() public {
        // Should be able to request chainLength - 1 random numbers successfully.
        for (uint64 i = 0; i < provider1ChainLength - 1; i++) {
            request(user1, provider1, i, false);
        }

        // FIXME
        // assertRequestReverts(user1, random.getFee(provider1), provider1, provider1ChainLength - 1, false);
    }

    function testGetFee() public {
        assertEq(random.getFee(provider1), pythFeeInWei + provider1FeeInWei);
        assertEq(random.getFee(provider2), pythFeeInWei + provider2FeeInWei);
        // Requesting the fee for a nonexistent provider returns pythFeeInWei. This isn't necessarily desirable behavior,
        // but it's unlikely to cause a problem.
        assertEq(random.getFee(unregisteredProvider), pythFeeInWei);

        // Check that overflowing the fee arithmetic causes the transaction to revert.
        vm.prank(provider1);
        random.register(
            MAX_UINT256,
            provider1Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            100
        );
        vm.expectRevert();
        random.getFee(provider1);
    }

    function testFees() public {
        // Insufficient fees causes a revert
        // assertRequestReverts(user2, 0, provider1, 42, false);

        // assertRequestReverts(user2, pythFeeInWei + provider1FeeInWei - 1, provider1, 42, false);

        uint fee = pythFeeInWei + provider1FeeInWei - 1;
        vm.deal(user2, fee);
        vm.expectRevert();
        vm.prank(user2);
        uint64 sequenceNumber = random.request{
        value: fee
        }(provider1, random.constructUserCommitment(bytes32(42)), false);

        // assertRequestReverts(user2, 0, provider2, 42, false);
        // assertRequestReverts(user2, pythFeeInWei + provider2FeeInWei - 1, provider2, 42, false);

        // Accrue some fees for both providers
        for (uint i = 0; i < 3; i++) {
            request(user2, provider1, 42, false);
        }
        if (false) {
        request(user2, provider2, 42, false);
        // this call overpays for the random number
        requestWithFee(user2, pythFeeInWei + provider2FeeInWei + 10000, provider2, 42, false);

        assertEq(random.getProviderInfo(provider1).accruedFeesInWei, provider1FeeInWei * 3);
        assertEq(random.getProviderInfo(provider2).accruedFeesInWei, provider2FeeInWei * 2);
        assertEq(random.getAccruedPythFees(), pythFeeInWei * 5 + 10000);
        assertInvariants();

        // Reregistering updates the required fees
        vm.prank(provider1);
        random.register(
            12345,
            provider1Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            100
        );

        assertRequestReverts(user2, pythFeeInWei + 12345 - 1, provider1, 42, false);

        requestWithFee(user2, pythFeeInWei + 12345, provider1, 42, false);

        uint providerOneBalance = provider1FeeInWei * 3 + 12345;
        assertEq(random.getProviderInfo(provider1).accruedFeesInWei, providerOneBalance);
        assertInvariants();

        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.withdraw(1000);

        vm.prank(provider1);
        random.withdraw(1000);

        assertEq(random.getProviderInfo(provider1).accruedFeesInWei, providerOneBalance - 1000);
        assertInvariants();

        vm.prank(provider1);
        vm.expectRevert();
        random.withdraw(providerOneBalance);
        }
    }

    // TODO
    // - what's the impact of # of in-flight requests on gas usage?
    // - what happens if you run out of randomness
    // - test all reverts
    // - test blockhash feature
    // - fuzz test?
}

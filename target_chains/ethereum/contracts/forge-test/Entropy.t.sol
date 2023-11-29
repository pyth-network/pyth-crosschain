// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "./utils/EntropyTestUtils.t.sol";
import "../contracts/entropy/EntropyUpgradable.sol";
import "./utils/Proxy.t.sol";

// TODO
// - fuzz test?
contract EntropyTest is Test, EntropyTestUtils {
    EntropyUpgradable public _random;
    UUPSProxy public proxy;
    EntropyUpgradable public random;

    uint128 pythFeeInWei = 7;

    address public provider1 = address(1);
    bytes32[] provider1Proofs;
    uint128 provider1FeeInWei = 8;
    uint64 provider1ChainLength = 100;
    bytes provider1Uri = bytes("https://foo.com");
    bytes provider1CommitmentMetadata = hex"0100";

    address public provider2 = address(2);
    bytes32[] provider2Proofs;
    uint128 provider2FeeInWei = 20;
    bytes provider2Uri = bytes("https://bar.com");

    address public user1 = address(3);
    address public user2 = address(4);

    address public unregisteredProvider = address(7);
    uint128 MAX_UINT128 = 2 ** 128 - 1;
    bytes32 ALL_ZEROS = bytes32(uint256(0));

    address public owner = address(8);
    address public admin = address(9);

    function setUp() public {
        _random = new EntropyUpgradable();
        // deploy proxy contract and point it to implementation
        proxy = new UUPSProxy(address(_random), "");
        // wrap in ABI to support easier calls
        random = EntropyUpgradable(address(proxy));

        random.initialize(owner, admin, pythFeeInWei, provider1);

        bytes32[] memory hashChain1 = generateHashChain(
            provider1,
            0,
            provider1ChainLength
        );
        provider1Proofs = hashChain1;
        vm.prank(provider1);
        random.register(
            provider1FeeInWei,
            provider1Proofs[0],
            provider1CommitmentMetadata,
            provider1ChainLength,
            provider1Uri
        );

        bytes32[] memory hashChain2 = generateHashChain(provider2, 0, 100);
        provider2Proofs = hashChain2;
        vm.prank(provider2);
        random.register(
            provider2FeeInWei,
            provider2Proofs[0],
            hex"0200",
            100,
            provider2Uri
        );
    }

    // Test helper method for requesting a random value as user from provider.
    function request(
        address user,
        address provider,
        uint randomNumber,
        bool useBlockhash
    ) public returns (uint64 sequenceNumber) {
        sequenceNumber = requestWithFee(
            user,
            random.getFee(provider),
            provider,
            randomNumber,
            useBlockhash
        );
    }

    function requestWithFee(
        address user,
        uint fee,
        address provider,
        uint randomNumber,
        bool useBlockhash
    ) public returns (uint64 sequenceNumber) {
        vm.deal(user, fee);
        vm.prank(user);
        sequenceNumber = random.request{value: fee}(
            provider,
            random.constructUserCommitment(bytes32(randomNumber)),
            useBlockhash
        );
    }

    function assertRequestReverts(
        uint fee,
        address provider,
        uint randomNumber,
        bool useBlockhash
    ) public {
        // Note: for some reason vm.expectRevert() won't catch errors from the request function (?!),
        // even though they definitely revert. Use a try/catch instead for the moment, though the try/catch
        // doesn't let you simulate the msg.sender. However, it's fine if the msg.sender is the test contract.
        bool requestSucceeds = false;
        try
            random.request{value: fee}(
                provider,
                random.constructUserCommitment(bytes32(uint256(randomNumber))),
                useBlockhash
            )
        {
            requestSucceeds = true;
        } catch {
            requestSucceeds = false;
        }

        assert(!requestSucceeds);
    }

    function assertRevealSucceeds(
        address provider,
        uint64 sequenceNumber,
        uint userRandom,
        bytes32 providerRevelation,
        bytes32 hash
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
                hash
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
        uint expectedBalance = random
            .getProviderInfo(provider1)
            .accruedFeesInWei +
            random.getProviderInfo(provider2).accruedFeesInWei +
            random.getAccruedPythFees();
        assertEq(address(random).balance, expectedBalance);

        EntropyStructs.ProviderInfo memory info1 = random.getProviderInfo(
            provider1
        );
        assert(
            info1.originalCommitmentSequenceNumber <=
                info1.currentCommitmentSequenceNumber
        );
        assert(info1.currentCommitmentSequenceNumber < info1.sequenceNumber);
        assert(info1.sequenceNumber <= info1.endSequenceNumber);
        EntropyStructs.ProviderInfo memory info2 = random.getProviderInfo(
            provider2
        );
        assert(
            info2.originalCommitmentSequenceNumber <=
                info2.currentCommitmentSequenceNumber
        );
        assert(info2.sequenceNumber > info2.currentCommitmentSequenceNumber);
        assert(info2.sequenceNumber <= info2.endSequenceNumber);
    }

    function testBasicFlow() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);
        assertEq(random.getRequest(provider1, sequenceNumber).blockNumber, 0);

        assertRevealSucceeds(
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
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

    function testDefaultProvider() public {
        uint64 sequenceNumber = request(
            user2,
            random.getDefaultProvider(),
            42,
            false
        );
        assertEq(random.getRequest(provider1, sequenceNumber).blockNumber, 0);

        assertRevealReverts(
            random.getDefaultProvider(),
            sequenceNumber,
            42,
            provider2Proofs[sequenceNumber]
        );

        assertRevealSucceeds(
            random.getDefaultProvider(),
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );
    }

    function testNoSuchProvider() public {
        assertRequestReverts(10000000, unregisteredProvider, 42, false);
    }

    function testAdversarialReveal() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);

        // test revealing with the wrong hashes in the same chain
        for (uint256 i = 0; i < 10; i++) {
            if (i != sequenceNumber) {
                assertRevealReverts(
                    provider1,
                    sequenceNumber,
                    42,
                    provider1Proofs[i]
                );
            }
        }

        // test revealing with the wrong user revealed value.
        for (uint256 i = 0; i < 42; i++) {
            assertRevealReverts(
                provider1,
                sequenceNumber,
                i,
                provider1Proofs[sequenceNumber]
            );
        }

        // test revealing sequence numbers that haven't been requested yet.
        for (uint64 i = sequenceNumber + 1; i < sequenceNumber + 3; i++) {
            assertRevealReverts(
                provider1,
                i,
                42,
                provider1Proofs[sequenceNumber]
            );

            assertRevealReverts(provider1, i, 42, provider1Proofs[i]);
        }
    }

    function testConcurrentRequests() public {
        uint64 s1 = request(user1, provider1, 1, false);
        uint64 s2 = request(user2, provider1, 2, false);
        uint64 s3 = request(user1, provider1, 3, false);
        uint64 s4 = request(user1, provider1, 4, false);

        assertRevealSucceeds(provider1, s3, 3, provider1Proofs[s3], ALL_ZEROS);
        assertInvariants();

        uint64 s5 = request(user1, provider1, 5, false);

        assertRevealSucceeds(provider1, s4, 4, provider1Proofs[s4], ALL_ZEROS);
        assertInvariants();

        assertRevealSucceeds(provider1, s1, 1, provider1Proofs[s1], ALL_ZEROS);
        assertInvariants();

        assertRevealSucceeds(provider1, s2, 2, provider1Proofs[s2], ALL_ZEROS);
        assertInvariants();

        assertRevealSucceeds(provider1, s5, 5, provider1Proofs[s5], ALL_ZEROS);
        assertInvariants();
    }

    function testBlockhash() public {
        vm.roll(1234);
        uint64 sequenceNumber = request(user2, provider1, 42, true);

        assertEq(
            random.getRequest(provider1, sequenceNumber).blockNumber,
            1234
        );

        assertRevealSucceeds(
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            blockhash(1234)
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

    function testProviderCommitmentRotation() public {
        uint userRandom = 42;
        uint64 sequenceNumber1 = request(user2, provider1, userRandom, false);
        uint64 sequenceNumber2 = request(user2, provider1, userRandom, false);
        assertInvariants();

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
            hex"0100",
            10,
            provider1Uri
        );
        assertInvariants();
        EntropyStructs.ProviderInfo memory info1 = random.getProviderInfo(
            provider1
        );
        assertEq(info1.endSequenceNumber, newHashChainOffset + 10);

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
            provider1Proofs[sequenceNumber1],
            ALL_ZEROS
        );
        assertInvariants();

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
            newHashChain[sequenceNumber3 - newHashChainOffset],
            ALL_ZEROS
        );
        assertInvariants();
    }

    function testOutOfRandomness() public {
        // Should be able to request chainLength - 1 random numbers successfully.
        for (uint64 i = 0; i < provider1ChainLength - 1; i++) {
            request(user1, provider1, i, false);
        }

        assertRequestReverts(
            random.getFee(provider1),
            provider1,
            provider1ChainLength - 1,
            false
        );
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
            MAX_UINT128,
            provider1Proofs[0],
            hex"0100",
            100,
            provider1Uri
        );
        vm.expectRevert();
        random.getFee(provider1);
    }

    function testOverflow() public {
        // msg.value overflows the uint128 fee variable
        assertRequestReverts(2 ** 128, provider1, 42, false);

        // block number is too large
        vm.roll(2 ** 96);
        assertRequestReverts(
            pythFeeInWei + provider1FeeInWei,
            provider1,
            42,
            true
        );
    }

    function testFees() public {
        // Insufficient fees causes a revert
        assertRequestReverts(0, provider1, 42, false);
        assertRequestReverts(
            pythFeeInWei + provider1FeeInWei - 1,
            provider1,
            42,
            false
        );
        assertRequestReverts(0, provider2, 42, false);
        assertRequestReverts(
            pythFeeInWei + provider2FeeInWei - 1,
            provider2,
            42,
            false
        );

        // Accrue some fees for both providers
        for (uint i = 0; i < 3; i++) {
            request(user2, provider1, 42, false);
        }

        request(user2, provider2, 42, false);
        // this call overpays for the random number
        requestWithFee(
            user2,
            pythFeeInWei + provider2FeeInWei + 10000,
            provider2,
            42,
            false
        );

        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            provider1FeeInWei * 3
        );
        assertEq(
            random.getProviderInfo(provider2).accruedFeesInWei,
            provider2FeeInWei * 2
        );
        assertEq(random.getAccruedPythFees(), pythFeeInWei * 5 + 10000);
        assertInvariants();

        // Reregistering updates the required fees
        vm.prank(provider1);
        random.register(
            12345,
            provider1Proofs[0],
            hex"0100",
            100,
            provider1Uri
        );

        assertRequestReverts(pythFeeInWei + 12345 - 1, provider1, 42, false);
        requestWithFee(user2, pythFeeInWei + 12345, provider1, 42, false);

        uint128 providerOneBalance = provider1FeeInWei * 3 + 12345;
        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            providerOneBalance
        );
        assertInvariants();

        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.withdraw(1000);

        vm.prank(provider1);
        random.withdraw(1000);

        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            providerOneBalance - 1000
        );
        assertInvariants();

        vm.prank(provider1);
        vm.expectRevert();
        random.withdraw(providerOneBalance);
    }

    function testGetProviderInfo() public {
        EntropyStructs.ProviderInfo memory providerInfo1 = random
            .getProviderInfo(provider1);
        // These two fields aren't used by the Entropy contract itself -- they're just convenient info to store
        // on-chain -- so they aren't tested in the other tests.
        assertEq(providerInfo1.uri, provider1Uri);
        assertEq(providerInfo1.commitmentMetadata, provider1CommitmentMetadata);
    }
}

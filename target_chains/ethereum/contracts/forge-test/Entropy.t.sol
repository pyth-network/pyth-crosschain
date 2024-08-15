// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyEvents.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./utils/EntropyTestUtils.t.sol";
import "../contracts/entropy/EntropyUpgradable.sol";

// TODO
// - fuzz test?
contract EntropyTest is Test, EntropyTestUtils, EntropyEvents {
    ERC1967Proxy public proxy;
    EntropyUpgradable public random;

    uint128 pythFeeInWei = 7;

    address public provider1 = address(1);
    bytes32[] provider1Proofs;
    uint128 provider1FeeInWei = 8;
    uint64 provider1ChainLength = 1000;
    uint32 provider1MaxNumHashes = 500;
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
    address public admin2 = address(10);

    function setUp() public {
        EntropyUpgradable _random = new EntropyUpgradable();
        // deploy proxy contract and point it to implementation
        proxy = new ERC1967Proxy(address(_random), "");
        // wrap in ABI to support easier calls
        random = EntropyUpgradable(address(proxy));

        random.initialize(owner, admin, pythFeeInWei, provider1, false);

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
        vm.prank(provider1);
        random.setMaxNumHashes(provider1MaxNumHashes);

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
        vm.startPrank(user);
        sequenceNumber = random.request{value: fee}(
            provider,
            random.constructUserCommitment(bytes32(randomNumber)),
            useBlockhash
        );
        vm.stopPrank();
    }

    function assertRequestReverts(
        uint fee,
        address provider,
        uint randomNumber,
        bool useBlockhash,
        bytes4 revertReason
    ) public {
        bytes32 userCommitment = random.constructUserCommitment(
            bytes32(uint256(randomNumber))
        );
        vm.deal(address(this), fee);
        vm.expectRevert(revertReason);
        random.request{value: fee}(provider, userCommitment, useBlockhash);
    }

    function assertRevealSucceeds(
        address user,
        address provider,
        uint64 sequenceNumber,
        uint userRandom,
        bytes32 providerRevelation,
        bytes32 hash
    ) public {
        vm.prank(user);
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
        address user,
        address provider,
        uint64 sequenceNumber,
        uint userRandom,
        bytes32 providerRevelation
    ) public {
        vm.startPrank(user);
        vm.expectRevert();
        random.reveal(
            provider,
            sequenceNumber,
            bytes32(uint256(userRandom)),
            providerRevelation
        );
        vm.stopPrank();
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
        vm.roll(17);
        uint64 sequenceNumber = request(user2, provider1, 42, false);
        assertEq(random.getRequest(provider1, sequenceNumber).blockNumber, 17);
        assertEq(
            random.getRequest(provider1, sequenceNumber).useBlockhash,
            false
        );

        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );

        EntropyStructs.Request memory reqAfterReveal = random.getRequest(
            provider1,
            sequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);

        // You can only reveal the random number once. This isn't a feature of the contract per se, but it is
        // the expected behavior.
        assertRevealReverts(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );
    }

    function testDefaultProvider() public {
        vm.roll(20);
        uint64 sequenceNumber = request(
            user2,
            random.getDefaultProvider(),
            42,
            false
        );
        assertEq(random.getRequest(provider1, sequenceNumber).blockNumber, 20);
        assertEq(
            random.getRequest(provider1, sequenceNumber).useBlockhash,
            false
        );

        assertRevealReverts(
            user2,
            random.getDefaultProvider(),
            sequenceNumber,
            42,
            provider2Proofs[sequenceNumber]
        );

        assertRevealSucceeds(
            user2,
            random.getDefaultProvider(),
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );
    }

    function testNoSuchProvider() public {
        assertRequestReverts(
            10000000,
            unregisteredProvider,
            42,
            false,
            EntropyErrors.NoSuchProvider.selector
        );
    }

    function testAuthorization() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);
        assertEq(random.getRequest(provider1, sequenceNumber).requester, user2);

        // user1 not authorized, must be user2.
        assertRevealReverts(
            user1,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );

        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );
    }

    function testAdversarialReveal() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);

        // test revealing with the wrong hashes in the same chain
        for (uint256 i = 0; i < 10; i++) {
            if (i != sequenceNumber) {
                assertRevealReverts(
                    user2,
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
                user2,
                provider1,
                sequenceNumber,
                i,
                provider1Proofs[sequenceNumber]
            );
        }

        // test revealing sequence numbers that haven't been requested yet.
        for (uint64 i = sequenceNumber + 1; i < sequenceNumber + 3; i++) {
            assertRevealReverts(
                user2,
                provider1,
                i,
                42,
                provider1Proofs[sequenceNumber]
            );

            assertRevealReverts(user2, provider1, i, 42, provider1Proofs[i]);
        }
    }

    function testConcurrentRequests() public {
        uint64 s1 = request(user1, provider1, 1, false);
        uint64 s2 = request(user2, provider1, 2, false);
        uint64 s3 = request(user1, provider1, 3, false);
        uint64 s4 = request(user1, provider1, 4, false);

        assertRevealSucceeds(
            user1,
            provider1,
            s3,
            3,
            provider1Proofs[s3],
            ALL_ZEROS
        );
        assertInvariants();

        uint64 s5 = request(user1, provider1, 5, false);

        assertRevealSucceeds(
            user1,
            provider1,
            s4,
            4,
            provider1Proofs[s4],
            ALL_ZEROS
        );
        assertInvariants();

        assertRevealSucceeds(
            user1,
            provider1,
            s1,
            1,
            provider1Proofs[s1],
            ALL_ZEROS
        );
        assertInvariants();

        assertRevealSucceeds(
            user2,
            provider1,
            s2,
            2,
            provider1Proofs[s2],
            ALL_ZEROS
        );
        assertInvariants();

        assertRevealSucceeds(
            user1,
            provider1,
            s5,
            5,
            provider1Proofs[s5],
            ALL_ZEROS
        );
        assertInvariants();
    }

    function testBlockhash() public {
        vm.roll(1234);
        uint64 sequenceNumber = request(user2, provider1, 42, true);

        assertEq(
            random.getRequest(provider1, sequenceNumber).blockNumber,
            1234
        );
        assertEq(
            random.getRequest(provider1, sequenceNumber).useBlockhash,
            true
        );

        vm.roll(1235);
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            blockhash(1234)
        );
    }

    function testNoCheckOnBlockNumberWhenNoBlockHashUsed() public {
        vm.roll(1234);
        uint64 sequenceNumber = request(user2, provider1, 42, false);

        vm.roll(1236);
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );

        vm.roll(1234);
        sequenceNumber = request(user2, provider1, 42, false);

        vm.roll(1234);
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );

        vm.roll(1234);
        sequenceNumber = request(user2, provider1, 42, false);

        vm.roll(1234 + 257);
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            ALL_ZEROS
        );
    }

    function testCheckOnBlockNumberWhenBlockHashUsed() public {
        vm.roll(1234);
        uint64 sequenceNumber = request(user2, provider1, 42, true);

        vm.roll(1234);
        assertRevealReverts(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );

        vm.roll(1234 + 257);
        assertRevealReverts(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber]
        );

        vm.roll(1235);
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber,
            42,
            provider1Proofs[sequenceNumber],
            blockhash(1234)
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
                user2,
                provider1,
                sequenceNumber1,
                userRandom,
                newHashChain[i]
            );
        }
        assertRevealSucceeds(
            user2,
            provider1,
            sequenceNumber1,
            userRandom,
            provider1Proofs[sequenceNumber1],
            ALL_ZEROS
        );
        assertInvariants();

        // Requests after the rotation use the new commitment
        assertRevealReverts(
            user2,
            provider1,
            sequenceNumber3,
            userRandom,
            provider1Proofs[sequenceNumber3]
        );
        assertRevealSucceeds(
            user2,
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
            uint64 sequenceNumber = request(user2, provider1, 42, false);
            assertRevealSucceeds(
                user2,
                provider1,
                sequenceNumber,
                42,
                provider1Proofs[sequenceNumber],
                ALL_ZEROS
            );
        }

        assertRequestReverts(
            random.getFee(provider1),
            provider1,
            provider1ChainLength - 1,
            false,
            EntropyErrors.OutOfRandomness.selector
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
        bytes32 userCommitment = random.constructUserCommitment(
            bytes32(uint256(42))
        );
        // msg.value overflows the uint128 fee variable
        uint fee = 2 ** 128;
        vm.deal(address(this), fee);
        vm.expectRevert("SafeCast: value doesn't fit in 128 bits");
        random.request{value: fee}(provider1, userCommitment, false);

        // block number is too large
        vm.roll(2 ** 96);
        vm.expectRevert("SafeCast: value doesn't fit in 64 bits");
        random.request{value: pythFeeInWei + provider1FeeInWei}(
            provider1,
            userCommitment,
            true
        );
    }

    function testFees() public {
        // Insufficient fees causes a revert
        assertRequestReverts(
            0,
            provider1,
            42,
            false,
            EntropyErrors.InsufficientFee.selector
        );
        assertRequestReverts(
            pythFeeInWei + provider1FeeInWei - 1,
            provider1,
            42,
            false,
            EntropyErrors.InsufficientFee.selector
        );
        assertRequestReverts(
            0,
            provider2,
            42,
            false,
            EntropyErrors.InsufficientFee.selector
        );
        assertRequestReverts(
            pythFeeInWei + provider2FeeInWei - 1,
            provider2,
            42,
            false,
            EntropyErrors.InsufficientFee.selector
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

        assertRequestReverts(
            pythFeeInWei + 12345 - 1,
            provider1,
            42,
            false,
            EntropyErrors.InsufficientFee.selector
        );
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

    function testSetProviderFee() public {
        assertNotEq(random.getProviderInfo(provider1).feeInWei, 1);

        vm.prank(provider1);
        random.setProviderFee(1);

        assertEq(random.getProviderInfo(provider1).feeInWei, 1);
    }

    function testSetProviderFeeByUnregistered() public {
        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.setProviderFee(1);
    }

    function testSetProviderUri() public {
        bytes memory newUri = bytes("https://new.com");

        assertNotEq0(random.getProviderInfo(provider1).uri, newUri);

        vm.prank(provider1);
        random.setProviderUri(newUri);

        assertEq0(random.getProviderInfo(provider1).uri, newUri);
    }

    function testSetProviderUriByUnregistered() public {
        bytes memory newUri = bytes("https://new.com");
        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.setProviderUri(newUri);
    }

    function testRequestWithCallbackAndReveal() public {
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyStructs.ProviderInfo memory providerInfo = random
            .getProviderInfo(provider1);

        vm.roll(1234);
        vm.deal(user1, fee);
        vm.startPrank(user1);
        vm.expectEmit(false, false, false, true, address(random));
        emit RequestedWithCallback(
            provider1,
            user1,
            providerInfo.sequenceNumber,
            userRandomNumber,
            EntropyStructs.Request({
                provider: provider1,
                sequenceNumber: providerInfo.sequenceNumber,
                numHashes: SafeCast.toUint32(
                    providerInfo.sequenceNumber -
                        providerInfo.currentCommitmentSequenceNumber
                ),
                commitment: keccak256(
                    bytes.concat(
                        random.constructUserCommitment(userRandomNumber),
                        providerInfo.currentCommitment
                    )
                ),
                blockNumber: 1234,
                requester: user1,
                useBlockhash: false,
                isRequestWithCallback: true
            })
        );
        vm.roll(1234);
        uint64 assignedSequenceNumber = random.requestWithCallback{value: fee}(
            provider1,
            userRandomNumber
        );

        assertEq(
            random.getRequest(provider1, assignedSequenceNumber).requester,
            user1
        );

        assertEq(
            random.getRequest(provider1, assignedSequenceNumber).provider,
            provider1
        );
        vm.expectRevert(EntropyErrors.InvalidRevealCall.selector);
        random.reveal(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );
        vm.stopPrank();
    }

    function testRequestWithCallbackAndRevealWithCallbackByContract() public {
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumer consumer = new EntropyConsumer(address(random));
        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );
        EntropyStructs.Request memory req = random.getRequest(
            provider1,
            assignedSequenceNumber
        );

        vm.expectEmit(false, false, false, true, address(random));
        emit RevealedWithCallback(
            req,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.prank(user1);
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        assertEq(consumer.sequence(), assignedSequenceNumber);
        assertEq(consumer.provider(), provider1);
        assertEq(
            consumer.randomness(),
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                // No blockhash is being used in callback method. As it
                // is being depreceated. Passing 0 for it.
                0
            )
        );

        EntropyStructs.Request memory reqAfterReveal = random.getRequest(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    function testRequestWithCallbackAndRevealWithCallbackByEoa() public {
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = random.requestWithCallback{value: fee}(
            provider1,
            userRandomNumber
        );
        EntropyStructs.Request memory req = random.getRequest(
            provider1,
            assignedSequenceNumber
        );

        vm.expectEmit(false, false, false, true, address(random));
        emit RevealedWithCallback(
            req,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        EntropyStructs.Request memory reqAfterReveal = random.getRequest(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    function testRequestAndRevealWithCallback() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);
        assertEq(random.getRequest(provider1, sequenceNumber).requester, user2);

        vm.expectRevert(EntropyErrors.InvalidRevealCall.selector);
        vm.prank(user2);
        random.revealWithCallback(
            provider1,
            sequenceNumber,
            bytes32(uint256(42)),
            provider1Proofs[sequenceNumber]
        );
    }

    function testRequestWithCallbackAndRevealWithCallbackFailing() public {
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumerFails consumer = new EntropyConsumerFails(
            address(random)
        );
        vm.deal(address(consumer), fee);
        vm.startPrank(address(consumer));
        uint64 assignedSequenceNumber = random.requestWithCallback{value: fee}(
            provider1,
            userRandomNumber
        );

        vm.expectRevert();
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );
    }

    function testLastRevealedTooOld() public {
        for (uint256 i = 0; i < provider1MaxNumHashes; i++) {
            request(user1, provider1, 42, false);
        }
        assertRequestReverts(
            random.getFee(provider1),
            provider1,
            42,
            false,
            EntropyErrors.LastRevealedTooOld.selector
        );
    }

    function testAdvanceProviderCommitment(
        uint32 requestCount,
        uint32 updateSeqNumber
    ) public {
        vm.assume(requestCount < provider1MaxNumHashes);
        vm.assume(updateSeqNumber < requestCount);
        vm.assume(0 < updateSeqNumber);

        for (uint256 i = 0; i < requestCount; i++) {
            request(user1, provider1, 42, false);
        }
        assertInvariants();
        EntropyStructs.ProviderInfo memory info1 = random.getProviderInfo(
            provider1
        );
        assertEq(info1.currentCommitmentSequenceNumber, 0);
        assertEq(info1.sequenceNumber, requestCount + 1);
        random.advanceProviderCommitment(
            provider1,
            updateSeqNumber,
            provider1Proofs[updateSeqNumber]
        );
        info1 = random.getProviderInfo(provider1);
        assertEq(info1.currentCommitmentSequenceNumber, updateSeqNumber);
        assertEq(info1.currentCommitment, provider1Proofs[updateSeqNumber]);
        assertEq(info1.sequenceNumber, requestCount + 1);
        assertInvariants();
    }

    function testAdvanceProviderCommitmentTooOld(
        uint32 requestCount,
        uint32 updateSeqNumber
    ) public {
        vm.assume(requestCount < provider1MaxNumHashes);
        vm.assume(updateSeqNumber < requestCount);
        vm.assume(0 < updateSeqNumber);

        for (uint256 i = 0; i < requestCount; i++) {
            request(user1, provider1, 42, false);
        }
        assertRevealSucceeds(
            user1,
            provider1,
            requestCount,
            42,
            provider1Proofs[requestCount],
            ALL_ZEROS
        );
        vm.expectRevert(EntropyErrors.UpdateTooOld.selector);
        random.advanceProviderCommitment(
            provider1,
            updateSeqNumber,
            provider1Proofs[updateSeqNumber]
        );
    }

    function testAdvanceProviderCommitmentIncorrectRevelation(
        uint32 seqNumber,
        uint32 mismatchedProofNumber
    ) public {
        vm.assume(seqNumber < provider1ChainLength);
        vm.assume(mismatchedProofNumber < provider1ChainLength);
        vm.assume(seqNumber != mismatchedProofNumber);
        vm.assume(seqNumber > 0);
        vm.expectRevert(EntropyErrors.IncorrectRevelation.selector);
        random.advanceProviderCommitment(
            provider1,
            seqNumber,
            provider1Proofs[mismatchedProofNumber]
        );
    }

    function testAdvanceProviderCommitmentUpdatesSequenceNumber(
        uint32 seqNumber
    ) public {
        vm.assume(seqNumber < provider1ChainLength);
        vm.assume(seqNumber > 0);
        random.advanceProviderCommitment(
            provider1,
            seqNumber,
            provider1Proofs[seqNumber]
        );
        EntropyStructs.ProviderInfo memory info1 = random.getProviderInfo(
            provider1
        );
        assertEq(info1.sequenceNumber, seqNumber + 1);
    }

    function testAdvanceProviderCommitmentHigherThanChainLength(
        uint32 seqNumber
    ) public {
        vm.assume(seqNumber >= provider1ChainLength);
        vm.expectRevert(EntropyErrors.AssertionFailure.selector);
        random.advanceProviderCommitment(
            provider1,
            seqNumber,
            provider1Proofs[0]
        );
    }

    function testSetMaxNumHashes(uint32 maxNumHashes) public {
        vm.prank(provider1);
        random.setMaxNumHashes(maxNumHashes);
        EntropyStructs.ProviderInfo memory info1 = random.getProviderInfo(
            provider1
        );
        assertEq(info1.maxNumHashes, maxNumHashes);
    }

    function testSetMaxNumHashesRevertIfNotFromProvider() public {
        vm.expectRevert(EntropyErrors.NoSuchProvider.selector);
        random.setMaxNumHashes(100);
    }

    function testZeroMaxNumHashesDisableChecks() public {
        for (uint256 i = 0; i < provider1MaxNumHashes; i++) {
            request(user1, provider1, 42, false);
        }
        assertRequestReverts(
            random.getFee(provider1),
            provider1,
            42,
            false,
            EntropyErrors.LastRevealedTooOld.selector
        );
        vm.prank(provider1);
        random.setMaxNumHashes(0);
        request(user1, provider1, 42, false);
    }

    function testFeeManager() public {
        address manager = address(12);

        // Make sure there are some fees for provider1
        request(user1, provider1, 42, false);

        // Manager isn't authorized, so can't withdraw or set fee.
        vm.prank(manager);
        vm.expectRevert();
        random.withdrawAsFeeManager(provider1, provider1FeeInWei);
        vm.prank(manager);
        vm.expectRevert();
        random.setProviderFeeAsFeeManager(provider1, 1000);

        // You can't set a fee manager from an address that isn't a registered provider.
        vm.expectRevert();
        random.setFeeManager(address(manager));

        // Authorizing the fee manager as the provider enables withdrawing and setting fees.
        vm.prank(provider1);
        random.setFeeManager(address(manager));

        // Withdrawing decrements provider's accrued fees and sends balance to the fee manager.
        uint startingBalance = manager.balance;
        vm.prank(manager);
        random.withdrawAsFeeManager(provider1, provider1FeeInWei);
        assertEq(random.getProviderInfo(provider1).accruedFeesInWei, 0);
        assertEq(manager.balance, startingBalance + provider1FeeInWei);

        // Setting provider fee updates the fee in the ProviderInfo.
        vm.prank(manager);
        random.setProviderFeeAsFeeManager(provider1, 10101);
        assertEq(random.getProviderInfo(provider1).feeInWei, 10101);

        // Authorizing a different manager depermissions the previous one.
        address manager2 = address(13);
        vm.prank(provider1);
        random.setFeeManager(address(manager2));
        vm.prank(manager);
        vm.expectRevert();
        random.withdrawAsFeeManager(provider1, provider1FeeInWei);
        vm.prank(manager);
        vm.expectRevert();
        random.setProviderFeeAsFeeManager(provider1, 1000);
    }
}

contract EntropyConsumer is IEntropyConsumer {
    uint64 public sequence;
    bytes32 public randomness;
    address public entropy;
    address public provider;

    constructor(address _entropy) {
        entropy = _entropy;
    }

    function requestEntropy(
        bytes32 randomNumber
    ) public payable returns (uint64 sequenceNumber) {
        address _provider = IEntropy(entropy).getDefaultProvider();
        sequenceNumber = IEntropy(entropy).requestWithCallback{
            value: msg.value
        }(_provider, randomNumber);
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(
        uint64 _sequence,
        address _provider,
        bytes32 _randomness
    ) internal override {
        sequence = _sequence;
        provider = _provider;
        randomness = _randomness;
    }
}

contract EntropyConsumerFails is IEntropyConsumer {
    uint64 public sequence;
    bytes32 public randomness;
    address public entropy;

    constructor(address _entropy) {
        entropy = _entropy;
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(uint64, address, bytes32) internal pure override {
        revert("Callback failed");
    }
}

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyEvents.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./utils/EntropyTestUtils.t.sol";
import "../contracts/entropy/EntropyUpgradable.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStatusConstants.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyEventsV2.sol";

// TODO
// - fuzz test?
contract EntropyTest is Test, EntropyTestUtils, EntropyEvents, EntropyEventsV2 {
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
            .getProviderInfoV2(provider1)
            .accruedFeesInWei +
            random.getProviderInfoV2(provider2).accruedFeesInWei +
            random.getAccruedPythFees();
        assertEq(address(random).balance, expectedBalance);

        EntropyStructsV2.ProviderInfo memory info1 = random.getProviderInfoV2(
            provider1
        );
        assert(
            info1.originalCommitmentSequenceNumber <=
                info1.currentCommitmentSequenceNumber
        );
        assert(info1.currentCommitmentSequenceNumber < info1.sequenceNumber);
        assert(info1.sequenceNumber <= info1.endSequenceNumber);
        EntropyStructsV2.ProviderInfo memory info2 = random.getProviderInfoV2(
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
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).blockNumber,
            17
        );
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).useBlockhash,
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

        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
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
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).blockNumber,
            20
        );
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).useBlockhash,
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
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).requester,
            user2
        );

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
            random.getRequestV2(provider1, sequenceNumber).blockNumber,
            1234
        );
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).useBlockhash,
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
        EntropyStructsV2.ProviderInfo memory info1 = random.getProviderInfoV2(
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
            random.getProviderInfoV2(provider1).accruedFeesInWei,
            provider1FeeInWei * 3
        );
        assertEq(
            random.getProviderInfoV2(provider2).accruedFeesInWei,
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
            random.getProviderInfoV2(provider1).accruedFeesInWei,
            providerOneBalance
        );
        assertInvariants();

        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.withdraw(1000);

        vm.prank(provider1);
        random.withdraw(1000);

        assertEq(
            random.getProviderInfoV2(provider1).accruedFeesInWei,
            providerOneBalance - 1000
        );
        assertInvariants();

        vm.prank(provider1);
        vm.expectRevert();
        random.withdraw(providerOneBalance);
    }

    function testGetProviderInfoV2() public {
        EntropyStructsV2.ProviderInfo memory providerInfo1 = random
            .getProviderInfoV2(provider1);
        // These two fields aren't used by the Entropy contract itself -- they're just convenient info to store
        // on-chain -- so they aren't tested in the other tests.
        assertEq(providerInfo1.uri, provider1Uri);
        assertEq(providerInfo1.commitmentMetadata, provider1CommitmentMetadata);
    }

    function testSetProviderFee() public {
        assertNotEq(random.getProviderInfoV2(provider1).feeInWei, 1);

        vm.prank(provider1);
        random.setProviderFee(1);

        assertEq(random.getProviderInfoV2(provider1).feeInWei, 1);
    }

    function testSetProviderFeeByUnregistered() public {
        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.setProviderFee(1);
    }

    function testSetProviderUri() public {
        bytes memory newUri = bytes("https://new.com");

        assertNotEq0(random.getProviderInfoV2(provider1).uri, newUri);

        vm.prank(provider1);
        random.setProviderUri(newUri);

        assertEq0(random.getProviderInfoV2(provider1).uri, newUri);
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
        EntropyStructsV2.ProviderInfo memory providerInfo = random
            .getProviderInfoV2(provider1);

        vm.roll(1234);
        vm.deal(user1, fee);
        vm.startPrank(user1);
        vm.expectEmit(true, true, true, true, address(random));
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
        vm.expectEmit(true, true, true, true, address(random));
        emit EntropyEventsV2.Requested(
            provider1,
            user1,
            providerInfo.sequenceNumber,
            userRandomNumber,
            0,
            bytes("")
        );
        vm.roll(1234);
        uint64 assignedSequenceNumber = random.requestWithCallback{value: fee}(
            provider1,
            userRandomNumber
        );

        assertEq(
            random.getRequestV2(provider1, assignedSequenceNumber).requester,
            user1
        );

        assertEq(
            random.getRequestV2(provider1, assignedSequenceNumber).provider,
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
        EntropyConsumer consumer = new EntropyConsumer(address(random), false);
        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );
        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );

        vm.expectEmit(true, true, true, true, address(random));
        emit RevealedWithCallback(
            EntropyStructConverter.toV1Request(req),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            req.requester,
            req.sequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            false,
            bytes(""),
            0,
            bytes("")
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

        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
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
        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );

        vm.expectEmit(true, true, true, true, address(random));
        emit RevealedWithCallback(
            EntropyStructConverter.toV1Request(req),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            req.requester,
            req.sequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            false,
            bytes(""),
            0,
            bytes("")
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    function testRequestAndRevealWithCallback() public {
        uint64 sequenceNumber = request(user2, provider1, 42, false);
        assertEq(
            random.getRequestV2(provider1, sequenceNumber).requester,
            user2
        );

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
        EntropyConsumer consumer = new EntropyConsumer(address(random), true);
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

    function testRequestWithCallbackGasLimit() public {
        uint32 defaultGasLimit = 100000;
        vm.prank(provider1);
        random.setDefaultGasLimit(defaultGasLimit);

        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumer consumer = new EntropyConsumer(address(random), false);
        vm.deal(user1, fee);
        vm.expectEmit(false, false, false, true, address(random));
        emit EntropyEventsV2.Requested(
            provider1,
            user1,
            0,
            userRandomNumber,
            100000,
            bytes("")
        );
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );
        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );

        // Verify the gas limit was set correctly
        assertEq(req.gasLimit10k, 10);

        vm.expectEmit(true, true, true, true, address(random));
        emit RevealedWithCallback(
            EntropyStructConverter.toV1Request(req),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            req.requester,
            req.sequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            false,
            bytes(""),
            0,
            bytes("")
        );
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
                0
            )
        );

        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    function testRequestWithRevertingCallback() public {
        uint32 defaultGasLimit = 100000;
        vm.prank(provider1);
        random.setDefaultGasLimit(defaultGasLimit);

        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumer consumer = new EntropyConsumer(address(random), true);
        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );

        // On the first attempt, the transaction should succeed and emit CallbackFailed event.
        bytes memory revertReason = abi.encodeWithSelector(
            0x08c379a0,
            "Callback failed"
        );
        vm.expectEmit(true, true, true, true, address(random));
        emit CallbackFailed(
            provider1,
            address(consumer),
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            revertReason
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            address(consumer),
            assignedSequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            true,
            revertReason,
            0,
            bytes("")
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Verify request is still active after failure
        EntropyStructsV2.Request memory reqAfterFailure = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterFailure.sequenceNumber, assignedSequenceNumber);
        assertTrue(
            reqAfterFailure.callbackStatus ==
                EntropyStatusConstants.CALLBACK_FAILED
        );

        // On the second attempt, the transaction should directly revert
        vm.expectRevert();
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Again, request stays active after failure
        reqAfterFailure = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterFailure.sequenceNumber, assignedSequenceNumber);
        assertTrue(
            reqAfterFailure.callbackStatus ==
                EntropyStatusConstants.CALLBACK_FAILED
        );

        // If the callback starts succeeding, we can invoke it and it emits the usual RevealedWithCallback event.
        consumer.setReverts(false);
        vm.expectEmit(true, true, true, true, address(random));
        emit RevealedWithCallback(
            EntropyStructConverter.toV1Request(reqAfterFailure),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            reqAfterFailure.requester,
            reqAfterFailure.sequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            false,
            bytes(""),
            0,
            bytes("")
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Verify request is cleared after successful reveal
        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    function testRequestWithCallbackUsingTooMuchGas() public {
        uint32 defaultGasLimit = 100000;
        vm.prank(provider1);
        random.setDefaultGasLimit(defaultGasLimit);

        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumer consumer = new EntropyConsumer(address(random), false);
        // Consumer callback uses ~10% more gas than the provider's default
        consumer.setTargetGasUsage((defaultGasLimit * 110) / 100);

        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );
        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );

        // Verify the gas limit was set correctly
        assertEq(req.gasLimit10k, 10);

        // The transaction reverts if the provider does not provide enough gas to forward
        // the gasLimit to the callback transaction.
        vm.expectRevert();
        random.revealWithCallback{gas: defaultGasLimit - 10000}(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // If called with enough gas, the transaction should succeed, but the callback should fail because
        // it uses too much gas.
        vm.expectEmit(true, true, true, true, address(random));
        emit CallbackFailed(
            provider1,
            address(consumer),
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            // out-of-gas reverts have an empty bytes array as the return value.
            ""
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            address(consumer),
            assignedSequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            true,
            "",
            0,
            bytes("")
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Verify request is still active after failure
        EntropyStructsV2.Request memory reqAfterFailure = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterFailure.sequenceNumber, assignedSequenceNumber);
        assertEq(
            reqAfterFailure.callbackStatus,
            EntropyStatusConstants.CALLBACK_FAILED
        );

        // A subsequent attempt passing insufficient gas should also revert
        vm.expectRevert();
        random.revealWithCallback{gas: defaultGasLimit - 10000}(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Again, request stays active after failure
        reqAfterFailure = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterFailure.sequenceNumber, assignedSequenceNumber);
        assertEq(
            reqAfterFailure.callbackStatus,
            EntropyStatusConstants.CALLBACK_FAILED
        );

        // Calling without a gas limit should succeed
        vm.expectEmit(true, true, true, true, address(random));
        emit RevealedWithCallback(
            EntropyStructConverter.toV1Request(reqAfterFailure),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            )
        );
        vm.expectEmit(true, true, true, false, address(random));
        emit EntropyEventsV2.Revealed(
            provider1,
            address(consumer),
            assignedSequenceNumber,
            random.combineRandomValues(
                userRandomNumber,
                provider1Proofs[assignedSequenceNumber],
                0
            ),
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber],
            false,
            "",
            0,
            bytes("")
        );
        random.revealWithCallback(
            provider1,
            assignedSequenceNumber,
            userRandomNumber,
            provider1Proofs[assignedSequenceNumber]
        );

        // Verify request is cleared after successful reveal
        EntropyStructsV2.Request memory reqAfterReveal = random.getRequestV2(
            provider1,
            assignedSequenceNumber
        );
        assertEq(reqAfterReveal.sequenceNumber, 0);
    }

    // Test the corner case caused by the CALL opcode passing at most 63/64ths of the current gas
    // to the sub-call.
    function testRequestWithCallbackUsingTooMuchGas2() public {
        // With a 64M gas limit, we will pass ~63M gas to the callback (which is insufficient), but still
        // have ~1M gas to execute code within the revealWithCallback method, which should be enough to
        // run all of the logic subsequent to the excessivelySafeCall.
        uint32 defaultGasLimit = 64000000;
        vm.prank(provider1);
        random.setDefaultGasLimit(defaultGasLimit);

        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);
        EntropyConsumer consumer = new EntropyConsumer(address(random), false);
        consumer.setTargetGasUsage(defaultGasLimit);

        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 assignedSequenceNumber = consumer.requestEntropy{value: fee}(
            userRandomNumber
        );

        // The transaction reverts if the provider does not provide enough gas to forward
        // the gasLimit to the callback transaction.
        vm.expectRevert(EntropyErrors.InsufficientGas.selector);
        random.revealWithCallback{gas: defaultGasLimit - 10000}(
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
        EntropyStructsV2.ProviderInfo memory info1 = random.getProviderInfoV2(
            provider1
        );
        assertEq(info1.currentCommitmentSequenceNumber, 0);
        assertEq(info1.sequenceNumber, requestCount + 1);
        random.advanceProviderCommitment(
            provider1,
            updateSeqNumber,
            provider1Proofs[updateSeqNumber]
        );
        info1 = random.getProviderInfoV2(provider1);
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
        EntropyStructsV2.ProviderInfo memory info1 = random.getProviderInfoV2(
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
        EntropyStructsV2.ProviderInfo memory info1 = random.getProviderInfoV2(
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
        assertEq(random.getProviderInfoV2(provider1).accruedFeesInWei, 0);
        assertEq(manager.balance, startingBalance + provider1FeeInWei);

        // Setting provider fee updates the fee in the ProviderInfo.
        vm.prank(manager);
        random.setProviderFeeAsFeeManager(provider1, 10101);
        assertEq(random.getProviderInfoV2(provider1).feeInWei, 10101);

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

    function testSetDefaultGasLimit() public {
        uint32 newGasLimit = 100000;

        vm.prank(provider1);
        vm.expectEmit(true, true, true, true, address(random));
        emit ProviderDefaultGasLimitUpdated(provider1, 0, newGasLimit);
        vm.expectEmit(true, true, true, true, address(random));
        emit EntropyEventsV2.ProviderDefaultGasLimitUpdated(
            provider1,
            0,
            newGasLimit,
            bytes("")
        );
        random.setDefaultGasLimit(newGasLimit);

        EntropyStructsV2.ProviderInfo memory info = random.getProviderInfoV2(
            provider1
        );
        assertEq(info.defaultGasLimit, newGasLimit);

        // Can reset back to 0.
        vm.prank(provider1);
        random.setDefaultGasLimit(0);
        info = random.getProviderInfoV2(provider1);
        assertEq(info.defaultGasLimit, 0);

        // Can set to maximum value.
        uint32 maxLimit = random.MAX_GAS_LIMIT();
        vm.prank(provider1);
        random.setDefaultGasLimit(maxLimit);
        info = random.getProviderInfoV2(provider1);
        assertEq(info.defaultGasLimit, random.MAX_GAS_LIMIT());

        // Reverts if max value is exceeded
        uint32 exceedsGasLimit = random.MAX_GAS_LIMIT() + 1;
        vm.prank(provider1);
        vm.expectRevert(EntropyErrors.MaxGasLimitExceeded.selector);
        random.setDefaultGasLimit(exceedsGasLimit);
    }

    function testSetDefaultGasLimitRevertIfNotFromProvider() public {
        vm.expectRevert(EntropyErrors.NoSuchProvider.selector);
        random.setDefaultGasLimit(100000);
    }

    function testRequestWithCallbackUsesDefaultGasLimit() public {
        uint32 defaultGasLimit = 100000;
        vm.prank(provider1);
        random.setDefaultGasLimit(defaultGasLimit);

        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFee(provider1);

        vm.deal(user1, fee);
        vm.prank(user1);
        uint64 sequenceNumber = random.requestWithCallback{value: fee}(
            provider1,
            userRandomNumber
        );

        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            sequenceNumber
        );
        assertEq(req.gasLimit10k, 10);
    }

    function testGasLimitsAndFeeRounding() public {
        vm.prank(provider1);
        random.setDefaultGasLimit(20000);
        vm.prank(provider1);
        random.setProviderFee(1);

        // Test exact multiples of 10,000
        assertGasLimitAndFee(0, 2, 1);
        assertGasLimitAndFee(10000, 2, 1);
        assertGasLimitAndFee(20000, 2, 1);
        assertGasLimitAndFee(100000, 10, 5);

        // Test values just below multiples of 10,000
        assertGasLimitAndFee(9999, 2, 1);
        assertGasLimitAndFee(19999, 2, 1);
        assertGasLimitAndFee(39999, 4, 2);
        assertGasLimitAndFee(99999, 10, 5);

        // Test values just above multiples of 10,000
        assertGasLimitAndFee(10001, 2, 1);
        assertGasLimitAndFee(20001, 3, 1);
        assertGasLimitAndFee(100001, 11, 5);
        assertGasLimitAndFee(110001, 12, 6);

        // Test middle values
        assertGasLimitAndFee(5000, 2, 1);
        assertGasLimitAndFee(15000, 2, 1);
        assertGasLimitAndFee(25000, 3, 1);

        // Test maximum value
        assertGasLimitAndFee(
            uint32(type(uint16).max) * 10000,
            type(uint16).max,
            uint128(type(uint16).max) / 2
        );

        // Test larger than max value reverts with expected error
        uint32 exceedsGasLimit = uint32(type(uint16).max) * 10000 + 1;
        vm.expectRevert(EntropyErrors.MaxGasLimitExceeded.selector);
        random.getFeeV2(provider1, exceedsGasLimit);
        vm.expectRevert(EntropyErrors.MaxGasLimitExceeded.selector);
        random.requestV2{value: 10000000000000}(
            provider1,
            bytes32(uint(42)),
            exceedsGasLimit
        );

        // A provider with a 0 gas limit is opted-out of the failure state flow, indicated by
        // a 0 gas limit on all requests.
        vm.prank(provider1);
        random.setDefaultGasLimit(0);

        assertGasLimitAndFee(0, 0, 1);
        assertGasLimitAndFee(10000, 0, 1);
        assertGasLimitAndFee(20000, 0, 1);
        assertGasLimitAndFee(100000, 0, 1);
    }

    // Helper method to create a request with a specific gas limit and check the gasLimit10k / provider fees
    function assertGasLimitAndFee(
        uint32 gasLimit,
        uint16 expectedGasLimit10k,
        uint128 expectedProviderFee
    ) internal {
        // Create a request with callback
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFeeV2(provider1, gasLimit);
        assertEq(fee - random.getPythFee(), expectedProviderFee);

        // Passing 1 wei less than the expected fee causes a revert.
        vm.deal(user1, fee);
        vm.prank(user1);
        vm.expectRevert(EntropyErrors.InsufficientFee.selector);
        random.requestV2{value: fee - 1}(provider1, userRandomNumber, gasLimit);

        EntropyStructsV2.ProviderInfo memory providerInfo = random
            .getProviderInfoV2(provider1);

        uint128 startingAccruedProviderFee = providerInfo.accruedFeesInWei;
        vm.expectEmit(true, true, true, true, address(random));
        emit EntropyEventsV2.Requested(
            provider1,
            user1,
            providerInfo.sequenceNumber,
            userRandomNumber,
            uint32(expectedGasLimit10k) * 10000,
            bytes("")
        );
        vm.prank(user1);
        uint64 sequenceNumber = random.requestV2{value: fee}(
            provider1,
            userRandomNumber,
            gasLimit
        );

        assertEq(
            random.getProviderInfoV2(provider1).accruedFeesInWei -
                startingAccruedProviderFee,
            expectedProviderFee
        );

        // Check the gasLimit10k field in the request
        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            sequenceNumber
        );
        assertEq(req.gasLimit10k, expectedGasLimit10k);
    }

    function testCallbackProvidedGas() public {
        vm.prank(provider1);
        random.setDefaultGasLimit(200000);

        assertCallbackResult(0, 190000, true);
        assertCallbackResult(0, 210000, false);
        assertCallbackResult(300000, 290000, true);
        assertCallbackResult(300000, 310000, false);

        // A provider that hasn't upgraded to the callback failure flow
        // can never cause a callback to fail because it runs out of gas.
        vm.prank(provider1);
        random.setDefaultGasLimit(0);
        assertCallbackResult(0, 190000, true);
        assertCallbackResult(0, 210000, true);
        assertCallbackResult(300000, 290000, true);
        assertCallbackResult(300000, 310000, true);
    }

    // Helper method to assert whether a request with a specific gas limit / a callback with a specific gas cost
    // should be successful or not.
    function assertCallbackResult(
        uint32 gasLimit,
        uint32 callbackGasUsage,
        bool expectSuccess
    ) internal {
        // Create a request with callback
        bytes32 userRandomNumber = bytes32(uint(42));
        uint fee = random.getFeeV2(provider1, gasLimit);

        vm.deal(user1, fee);
        vm.prank(user1);
        EntropyConsumer consumer = new EntropyConsumer(address(random), false);
        uint64 sequenceNumber = consumer.requestEntropyWithGasLimit{value: fee}(
            userRandomNumber,
            gasLimit
        );

        consumer.setTargetGasUsage(callbackGasUsage);

        EntropyStructsV2.Request memory req = random.getRequestV2(
            provider1,
            sequenceNumber
        );

        if (!expectSuccess) {
            vm.recordLogs();
            random.revealWithCallback(
                provider1,
                sequenceNumber,
                userRandomNumber,
                provider1Proofs[sequenceNumber]
            );
            Vm.Log[] memory entries = vm.getRecordedLogs();

            assertEq(entries.length, 2);
            // first entry is CallbackFailed which we aren't going to check.
            assertRevealedEvent(
                entries[1],
                address(consumer),
                sequenceNumber,
                userRandomNumber,
                true,
                callbackGasUsage
            );

            // Verify request is still active after failure
            EntropyStructsV2.Request memory reqAfterFailure = random
                .getRequestV2(provider1, sequenceNumber);
            assertEq(reqAfterFailure.sequenceNumber, sequenceNumber);
            assertEq(
                reqAfterFailure.callbackStatus,
                EntropyStatusConstants.CALLBACK_FAILED
            );
        } else {
            vm.recordLogs();
            random.revealWithCallback(
                provider1,
                sequenceNumber,
                userRandomNumber,
                provider1Proofs[sequenceNumber]
            );

            Vm.Log[] memory entries = vm.getRecordedLogs();

            assertEq(entries.length, 2);
            assertRevealedEvent(
                entries[1],
                req.requester,
                req.sequenceNumber,
                userRandomNumber,
                false,
                callbackGasUsage
            );

            // Verify request is cleared after successful callback
            EntropyStructsV2.Request memory reqAfterSuccess = random
                .getRequestV2(provider1, sequenceNumber);
            assertEq(reqAfterSuccess.sequenceNumber, 0);
        }
    }

    // Helper method to check the Revealed event
    function assertRevealedEvent(
        Vm.Log memory entry,
        address expectedRequester,
        uint64 expectedSequenceNumber,
        bytes32 expectedUserContribution,
        bool expectedCallbackFailed,
        uint32 expectedCallbackGasUsage
    ) internal {
        // Check event topic
        assertEq(
            entry.topics[0],
            keccak256(
                "Revealed(address,address,uint64,bytes32,bytes32,bytes32,bool,bytes,uint32,bytes)"
            )
        );

        // Check event topics
        assertEq(entry.topics[1], bytes32(uint256(uint160(provider1))));
        assertEq(entry.topics[2], bytes32(uint256(uint160(expectedRequester))));
        assertEq(entry.topics[3], bytes32(uint256(expectedSequenceNumber)));

        bytes32 expectedRandomNumber = random.combineRandomValues(
            expectedUserContribution,
            provider1Proofs[expectedSequenceNumber],
            0
        );

        // Decode and check event data
        (
            bytes32 randomNumber,
            bytes32 userContribution,
            bytes32 providerContribution,
            bool callbackFailed,
            bytes memory callbackErrorCode,
            uint32 callbackGasUsed,
            bytes memory extraArgs
        ) = abi.decode(
                entry.data,
                (bytes32, bytes32, bytes32, bool, bytes, uint32, bytes)
            );

        assertEq(randomNumber, expectedRandomNumber);
        assertEq(userContribution, expectedUserContribution);
        assertEq(providerContribution, provider1Proofs[expectedSequenceNumber]);
        assertEq(callbackFailed, expectedCallbackFailed);
        assertEq(callbackErrorCode, bytes(""));
        // callback gas usage is approximate
        assertTrue((expectedCallbackGasUsage * 90) / 100 < callbackGasUsed);
        assertTrue(callbackGasUsed < (expectedCallbackGasUsage * 110) / 100);
        assertEq(extraArgs, bytes(""));
    }
}

contract EntropyConsumer is IEntropyConsumer {
    uint64 public sequence;
    bytes32 public randomness;
    address public provider;
    address public entropy;
    bool public reverts;
    uint256 public targetGasUsage;

    constructor(address _entropy, bool _reverts) {
        entropy = _entropy;
        reverts = _reverts;
        targetGasUsage = 0; // Default target
    }

    function requestEntropy(
        bytes32 randomNumber
    ) public payable returns (uint64 sequenceNumber) {
        address _provider = IEntropy(entropy).getDefaultProvider();
        sequenceNumber = IEntropy(entropy).requestV2{value: msg.value}(
            _provider,
            randomNumber,
            0
        );
    }

    function requestEntropyWithGasLimit(
        bytes32 randomNumber,
        uint32 gasLimit
    ) public payable returns (uint64 sequenceNumber) {
        address _provider = IEntropy(entropy).getDefaultProvider();
        sequenceNumber = IEntropy(entropy).requestV2{value: msg.value}(
            _provider,
            randomNumber,
            gasLimit
        );
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function setReverts(bool _reverts) public {
        reverts = _reverts;
    }

    function setTargetGasUsage(uint256 _targetGasUsage) public {
        require(
            _targetGasUsage > 60000,
            "Target gas usage cannot be below 60k (~the cost of storing callback results)"
        );
        targetGasUsage = _targetGasUsage;
    }

    function entropyCallback(
        uint64 _sequence,
        address _provider,
        bytes32 _randomness
    ) internal override {
        uint256 startGas = gasleft();
        // These seemingly innocuous instructions are actually quite expensive
        // (~60k gas) because they're writes to contract storage.
        sequence = _sequence;
        provider = _provider;
        randomness = _randomness;

        // Keep consuming gas until we reach our target
        uint256 currentGasUsed = startGas - gasleft();
        while (currentGasUsed < targetGasUsage) {
            // Consume gas with a hash operation
            keccak256(abi.encodePacked(currentGasUsed, _randomness));
            currentGasUsed = startGas - gasleft();
        }

        if (reverts) {
            revert("Callback failed");
        }
    }
}

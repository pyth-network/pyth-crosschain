// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../../contracts/wormhole/Implementation.sol";
import "../../contracts/wormhole/Setup.sol";
import "../../contracts/wormhole/Wormhole.sol";
import "../../contracts/wormhole/interfaces/IWormhole.sol";

import "../../contracts/wormhole-receiver/ReceiverImplementation.sol";
import "../../contracts/wormhole-receiver/ReceiverSetup.sol";
import "../../contracts/wormhole-receiver/WormholeReceiver.sol";
import "../../contracts/wormhole-receiver/ReceiverGovernanceStructs.sol";

import "forge-std/Test.sol";

abstract contract WormholeTestUtils is Test {
    uint256[] currentSigners;
    address wormholeReceiverAddr;
    uint16 constant CHAIN_ID = 2; // Ethereum
    uint16 constant GOVERNANCE_CHAIN_ID = 1; // solana
    bytes32 constant GOVERNANCE_CONTRACT =
        0x0000000000000000000000000000000000000000000000000000000000000004;

    function setUpWormhole(uint8 numGuardians) public returns (address) {
        Implementation wormholeImpl = new Implementation();
        Setup wormholeSetup = new Setup();

        Wormhole wormhole = new Wormhole(address(wormholeSetup), new bytes(0));

        address[] memory initSigners = new address[](numGuardians);
        currentSigners = new uint256[](numGuardians);

        for (uint256 i = 0; i < numGuardians; ++i) {
            currentSigners[i] = i + 1;
            initSigners[i] = vm.addr(currentSigners[i]); // i+1 is the private key for the i-th signer.
        }

        // These values are the default values used in our tilt test environment
        // and are not important.
        Setup(address(wormhole)).setup(
            address(wormholeImpl),
            initSigners,
            CHAIN_ID, // Ethereum chain ID
            GOVERNANCE_CHAIN_ID, // Governance source chain ID (1 = solana)
            GOVERNANCE_CONTRACT // Governance source address
        );

        return address(wormhole);
    }

    function setUpWormholeReceiver(
        uint8 numGuardians
    ) public returns (address) {
        ReceiverImplementation wormholeReceiverImpl = new ReceiverImplementation();
        ReceiverSetup wormholeReceiverSetup = new ReceiverSetup();

        WormholeReceiver wormholeReceiver = new WormholeReceiver(
            address(wormholeReceiverSetup),
            new bytes(0)
        );

        address[] memory initSigners = new address[](numGuardians);
        currentSigners = new uint256[](numGuardians);

        for (uint256 i = 0; i < numGuardians; ++i) {
            currentSigners[i] = i + 1;
            initSigners[i] = vm.addr(currentSigners[i]); // i+1 is the private key for the i-th signer.
        }

        // These values are the default values used in our tilt test environment
        // and are not important.
        ReceiverSetup(address(wormholeReceiver)).setup(
            address(wormholeReceiverImpl),
            initSigners,
            CHAIN_ID, // Ethereum chain ID
            GOVERNANCE_CHAIN_ID, // Governance source chain ID (1 = solana)
            GOVERNANCE_CONTRACT // Governance source address
        );
        wormholeReceiverAddr = address(wormholeReceiver);

        return wormholeReceiverAddr;
    }

    function isNotMatch(
        bytes memory a,
        bytes memory b
    ) public pure returns (bool) {
        return keccak256(a) != keccak256(b);
    }

    function generateVaa(
        uint32 timestamp,
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence,
        bytes memory payload,
        uint8 numSigners
    ) public view returns (bytes memory vaa) {
        bytes memory body = abi.encodePacked(
            timestamp,
            uint32(0), // Nonce. It is zero for single VAAs.
            emitterChainId,
            emitterAddress,
            sequence,
            uint8(0), // Consistency level (sometimes no. confirmation block). Not important here.
            payload
        );

        bytes32 hash = keccak256(abi.encodePacked(keccak256(body)));

        bytes memory signatures = new bytes(0);

        for (uint256 i = 0; i < numSigners; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(currentSigners[i], hash);

            // encodePacked uses padding for arrays and we don't want it, so we manually concat them.
            signatures = abi.encodePacked(
                signatures,
                uint8(i), // Guardian index of the signature
                r,
                s,
                v - 27 // v is either 27 or 28. 27 is added to v in Eth (following BTC) but Wormhole doesn't use it.
            );
        }

        vaa = abi.encodePacked(
            uint8(1), // Version
            IWormhole(wormholeReceiverAddr).getCurrentGuardianSetIndex(), // Guardian set index. it is initialized by 0
            numSigners,
            signatures,
            body
        );
    }

    function forgeVaa(
        uint32 timestamp,
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence,
        bytes memory payload,
        uint8 numSigners,
        bytes memory forgeItem
    ) public view returns (bytes memory vaa) {
        bytes memory body = abi.encodePacked(
            timestamp,
            uint32(0), // Nonce. It is zero for single VAAs.
            emitterChainId,
            emitterAddress,
            sequence,
            uint8(0), // Consistency level (sometimes no. confirmation block). Not important here.
            payload
        );

        bytes32 hash = keccak256(abi.encodePacked(keccak256(body)));

        bytes memory signatures = new bytes(0);

        for (uint256 i = 0; i < numSigners; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(
                isNotMatch(forgeItem, "vaaSignature")
                    ? currentSigners[i]
                    : currentSigners[i] + 1000,
                hash
            );
            // encodePacked uses padding for arrays and we don't want it, so we manually concat them.
            signatures = abi.encodePacked(
                signatures,
                isNotMatch(forgeItem, "vaaSignatureIndex")
                    ? uint8(i)
                    : uint8(0), // Guardian index of the signature
                r,
                s,
                v - 27 // v is either 27 or 28. 27 is added to v in Eth (following BTC) but Wormhole doesn't use it.
            );
        }

        vaa = abi.encodePacked(
            isNotMatch(forgeItem, "vaaVersion") ? uint8(1) : uint8(2), // Version
            isNotMatch(forgeItem, "vaaGuardianSetIndex")
                ? uint32(0)
                : uint32(1), // Guardian set index. it is initialized by 0
            isNotMatch(forgeItem, "vaaNumSigners+")
                ? isNotMatch(forgeItem, "vaaNumSigners-")
                    ? numSigners
                    : numSigners - 1
                : numSigners + 1,
            signatures,
            body
        );
    }

    function upgradeGuardianSet(uint256 numGuardians) public {
        IWormhole wormhole = IWormhole(wormholeReceiverAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(wormholeReceiverAddr)
        );
        bytes memory newGuardians = new bytes(0);

        for (uint256 i = 0; i < numGuardians; ++i) {
            // encodePacked uses padding for arrays and we don't want it, so we manually concat them.
            newGuardians = abi.encodePacked(newGuardians, vm.addr(i + 1 + 10));
        }
        bytes memory upgradeGuardianSetPayload = abi.encodePacked(
            bytes32(
                0x00000000000000000000000000000000000000000000000000000000436f7265
            ), // "Core" ReceiverGovernance module
            uint8(2), // action
            uint16(0), // chain (unused)
            wormhole.getCurrentGuardianSetIndex() + 1, // uint32 newGuardianSetIndex;
            uint8(numGuardians), // uint8 numGuardians;
            newGuardians // ReceiverStructs.GuardianSet newGuardianSet;
        );
        bytes memory setGuardianSetVaa = generateVaa(
            112,
            GOVERNANCE_CHAIN_ID, // emitter chainID (solana)
            GOVERNANCE_CONTRACT, // gov emitter addr
            10,
            upgradeGuardianSetPayload,
            4
        );
        whReceiverImpl.submitNewGuardianSet(setGuardianSetVaa);

        currentSigners = new uint256[](numGuardians);
        for (uint256 i = 0; i < numGuardians; ++i) {
            currentSigners[i] = i + 1 + 10;
        }
    }
}

contract WormholeTestUtilsTest is Test, WormholeTestUtils {
    uint32 constant TEST_VAA_TIMESTAMP = 112;
    uint16 constant TEST_EMITTER_CHAIN_ID = 7;
    bytes32 constant TEST_EMITTER_ADDR =
        0x0000000000000000000000000000000000000000000000000000000000000bad;
    uint64 constant TEST_SEQUENCE = 10;
    bytes constant TEST_PAYLOAD = hex"deadbeaf";
    uint8 constant TEST_NUM_SIGNERS = 4;

    function assertVmMatchesTestValues(
        Structs.VM memory vm,
        bool valid,
        string memory reason,
        bytes memory vaa
    ) private {
        assertTrue(valid);
        assertEq(reason, "");
        assertEq(vm.timestamp, TEST_VAA_TIMESTAMP);
        assertEq(vm.emitterChainId, TEST_EMITTER_CHAIN_ID);
        assertEq(vm.emitterAddress, TEST_EMITTER_ADDR);
        assertEq(vm.sequence, TEST_SEQUENCE);
        assertEq(vm.payload, TEST_PAYLOAD);
        // parseAndVerifyVM() returns an empty signatures array for gas savings since it's not used
        // after its been verified. parseVM() returns the full signatures array.
        vm = IWormhole(wormholeReceiverAddr).parseVM(vaa);
        assertEq(vm.signatures.length, TEST_NUM_SIGNERS);
    }

    function testGenerateVaaWorks() public {
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(5));

        bytes memory vaa = generateVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS
        );

        (Structs.VM memory vm, bool valid, string memory reason) = wormhole
            .parseAndVerifyVM(vaa);
        assertVmMatchesTestValues(vm, valid, reason, vaa);
    }

    function testParseAndVerifyWorksWithoutForging() public {
        uint8 numGuardians = 5;
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(numGuardians));
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            ""
        );
        (Structs.VM memory vm, bool valid, string memory reason) = wormhole
            .parseAndVerifyVM(vaa);
        assertVmMatchesTestValues(vm, valid, reason, vaa);
    }

    function testParseAndVerifyFailsIfVaaIsNotSignedByEnoughGuardians() public {
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(5));
        bytes memory vaa = generateVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            1 //numSigners
        );
        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "no quorum");
    }

    function testParseAndVerifyFailsIfVaaHasInvalidGuardianSetIndex() public {
        uint8 numGuardians = 5;
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(numGuardians));
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaGuardianSetIndex"
        );
        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "invalid guardian set");
    }

    function testParseAndVerifyFailsIfInvalidGuardianSignatureIndex() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the initial wormhole guardian set
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaSignatureIndex"
        );
        vm.expectRevert(
            // workaround for this error not being in an external library
            abi.encodeWithSignature("SignatureIndexesNotAscending()")
        );
        wormhole.parseAndVerifyVM(vaa);
    }

    function testParseAndVerifyFailsIfIncorrectVersion() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the initial wormhole guardian set
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaVersion"
        );
        vm.expectRevert(
            // workaround for this error not being in an external library
            abi.encodeWithSignature("VmVersionIncompatible()")
        );
        wormhole.parseAndVerifyVM(vaa);
    }

    function testUpgradeGuardianSetWorks() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        upgradeGuardianSet(5);
        // generate the vaa and sign with the new wormhole guardian set
        bytes memory vaa = generateVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS
        );
        vm.warp(block.timestamp + 5 days);

        (Structs.VM memory vm, bool valid, string memory reason) = wormhole
            .parseAndVerifyVM(vaa);
        assertVmMatchesTestValues(vm, valid, reason, vaa);
    }

    function testParseAndVerifyWorksIfUsingPreviousVaaGuardianSetBeforeItExpires()
        public
    {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the initial wormhole guardian set
        bytes memory vaa = generateVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS
        );

        upgradeGuardianSet(numGuardians);
        uint previousGuardianSetExpiration = wormhole
            .getGuardianSet(0)
            .expirationTime;
        // warp to 5 seconds before the previous guardian set expires
        vm.warp(previousGuardianSetExpiration - 5);
        (Structs.VM memory vm, bool valid, string memory reason) = wormhole
            .parseAndVerifyVM(vaa);
        assertVmMatchesTestValues(vm, valid, reason, vaa);
    }

    function testParseAndVerifyFailsIfVaaGuardianSetHasExpired() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = generateVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS
        );

        upgradeGuardianSet(numGuardians);
        vm.warp(block.timestamp + 5 days);
        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "guardian set has expired");
    }

    function testParseAndVerifyFailsIfInvalidGuardianSignature() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaSignature"
        );

        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "VM signature invalid");
    }

    function testParseAndVerifyFailsIfInvalidNumSignatures() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaNumSigners+"
        );

        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "invalid signature length");

        vaa = forgeVaa(
            TEST_VAA_TIMESTAMP,
            TEST_EMITTER_CHAIN_ID,
            TEST_EMITTER_ADDR,
            TEST_SEQUENCE,
            TEST_PAYLOAD,
            TEST_NUM_SIGNERS,
            "vaaNumSigners-"
        );

        (, valid, reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "VM signature invalid");
    }
}

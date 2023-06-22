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

        for (uint256 i = 0; i < numGuardians; ++i) {
            initSigners[i] = vm.addr(i + 1); // i+1 is the private key for the i-th signer.
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
    ) public returns (bytes memory vaa) {
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
    ) public returns (bytes memory vaa) {
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
                (i == numSigners - 1 &&
                    isNotMatch(forgeItem, "vaaSignatureIndex"))
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
        uint32 newGuardianSetIndex = uint32(1);
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
    function testGenerateVaaWorks() public {
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(5));

        bytes memory vaa = generateVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4
        );

        (Structs.VM memory vm, bool valid, ) = wormhole.parseAndVerifyVM(vaa);
        assertTrue(valid);

        assertEq(vm.timestamp, 112);
        assertEq(vm.emitterChainId, 7);
        assertEq(
            vm.emitterAddress,
            0x0000000000000000000000000000000000000000000000000000000000000bad
        );
        assertEq(vm.payload, hex"deadbeaf");
        // parseAndVerifyVM() returns an empty signatures array for gas savings since it's not used
        // after its been verified. parseVM() returns the full signatures array.
        vm = wormhole.parseVM(vaa);
        assertEq(vm.signatures.length, 4);
    }

    function testParseAndVerifyFailsIfVaaIsNotSignedByEnoughGuardians() public {
        IWormhole wormhole = IWormhole(setUpWormholeReceiver(5));
        bytes memory vaa = generateVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
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
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4,
            "vaaGuardianSetIndex"
        );
        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "invalid guardian set");
    }

    function testUpgradeGuardianSetWorks() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        upgradeGuardianSet(5);
        // generate the vaa and sign with the new wormhole guardian set
        bytes memory vaa = generateVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4
        );
        uint32 guardianSetIdx = wormhole.getCurrentGuardianSetIndex();
        vm.warp(block.timestamp + 5 days);

        (
            Structs.VM memory parsedVm,
            bool valid,
            string memory reason
        ) = wormhole.parseAndVerifyVM(vaa);
        assertTrue(valid);
        assertEq(reason, "");
        assertEq(parsedVm.timestamp, 112);
        assertEq(parsedVm.emitterChainId, 7);
        assertEq(
            parsedVm.emitterAddress,
            0x0000000000000000000000000000000000000000000000000000000000000bad
        );
        assertEq(parsedVm.payload, hex"deadbeaf");
    }

    function testParseAndVerifyWorksIfUsingPreviousVaaGuardianSetBeforeItExpires()
        public
    {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        // generate the vaa and sign with the initial wormhole guardian set
        bytes memory vaa = generateVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4
        );

        upgradeGuardianSet(numGuardians);
        uint32 guardianSetIdx = wormhole.getCurrentGuardianSetIndex();
        uint previousGuardianSetExpiration = wormhole
            .getGuardianSet(0)
            .expirationTime;
        // warp to 5 seconds before the previous guardian set expires
        vm.warp(previousGuardianSetExpiration - 5);
        (
            Structs.VM memory parsedVm,
            bool valid,
            string memory reason
        ) = wormhole.parseAndVerifyVM(vaa);
        assertTrue(valid);
        assertEq(reason, "");
        assertEq(parsedVm.timestamp, 112);
        assertEq(parsedVm.emitterChainId, 7);
        assertEq(
            parsedVm.emitterAddress,
            0x0000000000000000000000000000000000000000000000000000000000000bad
        );
        assertEq(parsedVm.payload, hex"deadbeaf");
    }

    function testParseAndVerifyFailsIfVaaGuardianSetHasExpired() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = generateVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4
        );

        upgradeGuardianSet(numGuardians);
        uint32 guardianSetIdx = wormhole.getCurrentGuardianSetIndex();
        vm.warp(block.timestamp + 5 days);
        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "guardian set has expired");
    }

    function testParseAndVerifyFailsIfInvalidGuardianSignature() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = forgeVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4,
            "vaaSignature"
        );

        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "VM signature invalid");
    }

    function testParseAndVerifyFailsIfInvalidGuardianSignatureIndex() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        // generate the vaa and sign with the initial wormhole guardian set
        bytes memory vaa = forgeVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4,
            "vaaSignatureIndex"
        );
        vm.expectRevert(
            abi.encodeWithSignature("SignatureIndexesNotAscending()")
        );
        wormhole.parseAndVerifyVM(vaa);
    }

    function testParseAndVerifyFailsIfInvalidNumSignatures() public {
        uint8 numGuardians = 5;
        address whAddr = setUpWormholeReceiver(numGuardians);
        IWormhole wormhole = IWormhole(whAddr);
        ReceiverImplementation whReceiverImpl = ReceiverImplementation(
            payable(whAddr)
        );
        // generate the vaa and sign with the current wormhole guardian set
        bytes memory vaa = forgeVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4,
            "vaaNumSigners+"
        );

        (, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "invalid signature length");

        vaa = forgeVaa(
            112,
            7,
            0x0000000000000000000000000000000000000000000000000000000000000bad,
            10,
            hex"deadbeaf",
            4,
            "vaaNumSigners-"
        );

        (, valid, reason) = wormhole.parseAndVerifyVM(vaa);
        assertEq(valid, false);
        assertEq(reason, "VM signature invalid");
    }
}

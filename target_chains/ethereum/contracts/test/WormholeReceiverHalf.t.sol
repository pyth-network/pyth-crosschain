// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "../contracts/wormhole/interfaces/IWormhole.sol";
import "./utils/WormholeTestUtils.t.sol";

contract WormholeReceiverHalfTest is Test, WormholeTestUtils {
    uint32 constant TEST_VAA_TIMESTAMP = 112;
    uint16 constant TEST_EMITTER_CHAIN_ID = 7;
    bytes32 constant TEST_EMITTER_ADDR =
        0x0000000000000000000000000000000000000000000000000000000000000bad;
    uint64 constant TEST_SEQUENCE = 10;
    bytes constant TEST_PAYLOAD = hex"deadbeaf";

    function _vaa(uint8 numSigners) internal view returns (bytes memory) {
        return
            generateVaa(
                TEST_VAA_TIMESTAMP,
                TEST_EMITTER_CHAIN_ID,
                TEST_EMITTER_ADDR,
                TEST_SEQUENCE,
                TEST_PAYLOAD,
                numSigners
            );
    }

    // n=5: half threshold = 5/2 + 1 = 3 (default 2/3+1 would be 4)
    function testHalfAcceptsAtThresholdOddGuardians() public {
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(5));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(3));
        assertTrue(valid);
        assertEq(reason, "");
    }

    function testHalfRejectsBelowThresholdOddGuardians() public {
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(5));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(2));
        assertFalse(valid);
        assertEq(reason, "no quorum");
    }

    // n=6: half threshold = 6/2 + 1 = 4 (default 2/3+1 would be 5)
    function testHalfAcceptsAtThresholdEvenGuardians() public {
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(6));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(4));
        assertTrue(valid);
        assertEq(reason, "");
    }

    function testHalfRejectsBelowThresholdEvenGuardians() public {
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(6));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(3));
        assertFalse(valid);
        assertEq(reason, "no quorum");
    }

    // The key behavioural difference: a VAA that would be rejected under the
    // default 2/3+1 quorum is accepted under the half-quorum variant.
    function testHalfAcceptsVaaBelowDefaultTwoThirds() public {
        // n=6: 4 sigs is below 2/3+1=5 but at half=4
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(6));
        (, bool valid, ) = wh.parseAndVerifyVM(_vaa(4));
        assertTrue(valid);
    }

    function testDefaultRejectsVaaThatHalfAccepts() public {
        // Same shape as above, but on the default impl: must be rejected.
        IWormhole wh = IWormhole(setUpWormholeReceiver(6));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(4));
        assertFalse(valid);
        assertEq(reason, "no quorum");
    }

    // n=19 (canonical Wormhole guardian set size): half=10, default=13.
    function testHalfLargeGuardianSetThreshold() public {
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(19));

        (, bool validAt, string memory reasonAt) = wh.parseAndVerifyVM(
            _vaa(10)
        );
        assertTrue(validAt);
        assertEq(reasonAt, "");

        (, bool validBelow, string memory reasonBelow) = wh.parseAndVerifyVM(
            _vaa(9)
        );
        assertFalse(validBelow);
        assertEq(reasonBelow, "no quorum");
    }

    function testHalfAcceptsAboveThreshold() public {
        // All guardians signing should always work.
        IWormhole wh = IWormhole(setUpWormholeReceiverHalf(5));
        (, bool valid, string memory reason) = wh.parseAndVerifyVM(_vaa(5));
        assertTrue(valid);
        assertEq(reason, "");
    }
}

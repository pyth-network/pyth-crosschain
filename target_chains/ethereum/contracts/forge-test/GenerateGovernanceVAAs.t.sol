// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "../contracts/pyth/PythGovernanceInstructions.sol";

contract GenerateGovernanceVAAs is Test, WormholeTestUtils, PythTestUtils, PythGovernanceInstructions {
    uint16 constant TEST_GOVERNANCE_CHAIN_ID = 1;
    bytes32 constant TEST_GOVERNANCE_EMITTER = 0x0000000000000000000000000000000000000000000000000000000000000011;
    uint16 constant TARGET_CHAIN_ID = 2;
    
    function setUp() public {
        // Initialize wormhole with 1 guardian to match the working tests
        setUpWormholeReceiver(1);
    }
    
    function testGenerateSetFeeInTokenVAA() public view {
        bytes memory setFeeInTokenMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetFeeInToken),
            TARGET_CHAIN_ID,
            uint64(5), // value
            uint64(3), // exponent
            uint8(20), // token address length
            hex"7e5f4552091a69125d5dfcb7b8c2659029395bdf" // token address
        );

        bytes memory vaa = encodeAndSignMessage(
            setFeeInTokenMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        console.log("test_set_fee_in_token VAA:");
        console.logBytes(vaa);
    }
    
    function testGenerateSetWormholeAddressVAA() public view {
        bytes memory setWormholeAddressMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetWormholeAddress),
            TARGET_CHAIN_ID,
            hex"7e5f4552091a69125d5dfcb7b8c2659029395bdf" // new wormhole address
        );

        bytes memory vaa = encodeAndSignMessage(
            setWormholeAddressMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        console.log("test_set_wormhole_address VAA:");
        console.logBytes(vaa);
    }
    
    function testGenerateAuthorizeGovernanceDataSourceTransferVAA() public view {
        // For AuthorizeGovernanceDataSourceTransfer, the claim_vaa is the remaining payload
        // Based on governance_structs.rs lines 167-172, it expects claim_vaa = payload[cursor..]
        bytes memory claimVaa = abi.encodePacked(
            hex"be7e5f4552091a69125d5dfcb7b8c2659029395bdf", // 21 bytes: prefix + address
            uint64(100), // 8 bytes: sequence
            uint64(3)    // 8 bytes: index
        );
        
        bytes memory authorizeMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.AuthorizeGovernanceDataSourceTransfer),
            TARGET_CHAIN_ID,
            claimVaa
        );

        bytes memory vaa = encodeAndSignMessage(
            authorizeMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        console.log("test_authorize_governance_data_source_transfer VAA:");
        console.logBytes(vaa);
    }
    
    function testGenerateSetTransactionFeeVAA() public view {
        bytes memory setTransactionFeeMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetTransactionFee),
            TARGET_CHAIN_ID,
            uint64(100), // value
            uint64(3) // exponent
        );

        bytes memory vaa = encodeAndSignMessage(
            setTransactionFeeMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        console.log("test_set_transaction_fee VAA:");
        console.logBytes(vaa);
    }
    
    function testGenerateWithdrawFeeVAA() public view {
        // For WithdrawFee, based on governance_structs.rs lines 348-384:
        // target_address (20 bytes) + value (8 bytes) + expo (8 bytes)
        bytes memory withdrawFeeMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.WithdrawFee),
            TARGET_CHAIN_ID,
            hex"7e5f4552091a69125d5dfcb7b8c2659029395bdf", // target_address (20 bytes)
            uint64(100), // value (8 bytes)
            uint64(3) // expo (8 bytes)
        );

        bytes memory vaa = encodeAndSignMessage(
            withdrawFeeMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        console.log("test_withdraw_fee VAA:");
        console.logBytes(vaa);
    }

    function encodeAndSignMessage(
        bytes memory data,
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence
    ) internal view returns (bytes memory) {
        return generateVaa(
            uint32(1), // timestamp = 1 (same as working VAAs)
            emitterChainId,
            emitterAddress,
            sequence,
            data,
            1 // Number of guardians
        );
    }
}

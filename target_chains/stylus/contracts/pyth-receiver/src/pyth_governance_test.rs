#[cfg(test)]
mod test {
    use crate::{
        DataSourcesSet, FeeSet, GovernanceDataSourceSet, PythReceiver, TransactionFeeSet,
        ValidPeriodSet,
    };
    use alloy_primitives::{address, Address, FixedBytes, U256};
    use hex::FromHex;
    use motsu::prelude::*;
    use wormhole_contract::WormholeContract;

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const CHAIN_ID: u16 = 2;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    const SINGLE_UPDATE_FEE_IN_WEI: U256 = U256::from_limbs([100, 0, 0, 0]);

    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_EMITTER: [u8; 32] = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x11,
    ];

    #[cfg(test)]
    fn pyth_wormhole_init(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
        guardian_set_index: u32,
    ) {
        let guardians = vec![address!("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf")];

        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(*alice)
            .initialize(
                guardians,
                guardian_set_index,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

        let single_update_fee = SINGLE_UPDATE_FEE_IN_WEI;
        let valid_time_period = U256::from(3600u64);

        let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
        let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

        let governance_chain_id = 1u16;
        let governance_initial_sequence = 0u64;

        let _ = pyth_contract.sender(*alice).initialize(
            wormhole_contract.address(),
            single_update_fee,
            valid_time_period,
            data_source_chain_ids,
            data_source_emitter_addresses,
            governance_chain_id,
            GOVERNANCE_EMITTER,
            governance_initial_sequence,
        );
    }

    #[motsu::test]
    fn test_set_data_sources(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010069825ef00344cf745b6e72a41d4f869d4e90de517849360c72bf94efc97681671d826e484747b21a80c8f1e7816021df9f55e458a6e7a717cb2bd2a1e85fd57100499602d200000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010200020100010000000000000000000000000000000000000000000000000000000000001111";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("SetDataSources Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());

        let expected_event = DataSourcesSet {
            old_data_sources: vec![FixedBytes::from(PYTHNET_EMITTER_ADDRESS)],
            new_data_sources: vec![FixedBytes::from([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x11, 0x11,
            ])],
        };
        assert!(
            pyth_contract.emitted(&expected_event),
            "DataSourcesSet event should be emitted"
        );

        let result2 = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        assert!(
            result2.is_err(),
            "Second execution should fail due to sequence number check"
        );
    }

    #[motsu::test]
    fn test_set_valid_period(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);
        let hex_str = "01000000000100c9effcab077af2f3f65a7abfd1883295529eab7c0d4434772ed1f2d10b1de3571c214af45e944a3fee65417c9f0c6024010dadc26d30bb361e05f552ca4de04d000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010400020000000000000003";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(
            result.is_ok(),
            "SetValidPeriod governance instruction should succeed"
        );

        let expected_event = ValidPeriodSet {
            old_valid_period: U256::from(3600),
            new_valid_period: U256::from(3),
        };

        assert!(
            pyth_contract.emitted(&expected_event),
            "ValidPeriodSet event should be emitted"
        );
    }

    #[motsu::test]
    fn test_set_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_ok());

        let expected_new_fee = U256::from(5000);
        let expected_event = FeeSet {
            old_fee: SINGLE_UPDATE_FEE_IN_WEI,
            new_fee: expected_new_fee,
        };
        assert!(
            pyth_contract.emitted(&expected_event),
            "FeeSet event should be emitted"
        );

        let result2 = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        assert!(
            result2.is_err(),
            "Second execution should fail due to sequence number check"
        );
    }

    // This test is commented out because it requires an already deployed new Wormhole contract.
    // This function demonstrates the usage of this instruction, however.
    /*
        #[motsu::test]
        fn test_set_wormhole_address(
            pyth_contract: Contract<PythReceiver>,
            wormhole_contract: Contract<WormholeContract>,
            wormhole_contract_2: Contract<WormholeContract>,
            alice: Address,
        ) {
            pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let guardians = vec![address!("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf")];
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract_2
            .sender(alice)
            .initialize(
                guardians,
                0,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();



        let hex_str = format!("010000000001001daf08e5e3799cbc6096a90c2361e43220325418f377620a7a73d6bece18322679f6ada9725d9081743805efb8bccecd51098f1d76f34cba8b835fae643bbd9c000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01060002{:040x}", wormhole_contract_2.address());
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!(
                "SetWormholeAddress Error: {:?}",
                result.as_ref().unwrap_err()
            );
        }
    */

    #[motsu::test]
    fn test_authorize_governance_data_source_transfer(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);
        let hex_str = "01000000000100eb6abceff17a900422cbe415bd4776aa6477ee6ec7f3f58d1635ea2071fb915e43c6ac312b34996d4a76c52de96a8c2cc1c50aacb45aa2013eb6c8d05a472f94010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01010002010000000001006fc27ac424b300c23a564bcabe1d7888a898cba92b8aec62468c35025baaf4a87056c50d443fbc172c3caa30d28ec57cefc0bbabf4590ffe98c44dff040d0e02000000000100000000000200000000000000000000000000000000000000000000000000000000000011110000000000000001005054474d0105000200000001";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!(
                "AuthorizeGovernanceDataSourceTransfer Error: {:?}",
                result.as_ref().unwrap_err()
            );
        }
        assert!(result.is_ok());

        const NEW_GOVERNANCE_EMITTER: [u8; 32] = [
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x11, 0x11,
        ];

        let expected_event = GovernanceDataSourceSet {
            old_chain_id: 0, // Initial governance_data_source_index
            old_emitter_address: FixedBytes::from(GOVERNANCE_EMITTER), // Initial governance emitter from pyth_wormhole_init
            new_chain_id: 2, // claim_vm.body.emitter_chain from the VAA
            new_emitter_address: FixedBytes::from(NEW_GOVERNANCE_EMITTER), // emitter_bytes from the VAA
            initial_sequence: 1, // claim_vm.body.sequence from the VAA (0x64 = 100)
        };
        assert!(
            pyth_contract.emitted(&expected_event),
            "GovernanceDataSourceSet event should be emitted"
        );
    }

    #[motsu::test]
    fn test_set_transaction_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "010000000001001554008232e74cb3ac74acc4527ead8a39637c537ec9b3d1fbb624c1f4f52e341e24ae89d978e033f5345e4af244df0ec61f380d9e33330f439d2b6764850270010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0108000200000000000000640000000000000003";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!(
                "SetTransactionFee Error: {:?}",
                result.as_ref().unwrap_err()
            );
        }
        assert!(result.is_ok());

        let expected_new_fee = U256::from(100000);
        let expected_event = TransactionFeeSet {
            old_fee: U256::ZERO,
            new_fee: expected_new_fee,
        };
        assert!(
            pyth_contract.emitted(&expected_event),
            "TransactionFeeSet event should be emitted"
        );

        let result2 = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        assert!(
            result2.is_err(),
            "Second execution should fail due to sequence number check"
        );
    }

    // Fee transfers can't be done in the motsu testing framework. This commented test serves as an example for how to use the function, though.

    /*
    #[motsu::test]
    fn test_withdraw_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010030f48904e130d76ee219bc59988f89526e5c9860e89efda3a74e33c3ab53d4e6036d1c67249d2f25a27e8c94d203609785839e3e4817d0a03214ea8bbf6a8415000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0109000270997970c51812dc3a010c7d01b50e0d17dc79c800000000000000640000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        pyth_contract.address().fund(U256::from(200000u64));

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        if result.is_err() {
            println!("WithdrawFee Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }
    */

    #[motsu::test]
    fn test_invalid_wormhole_vaa_signature_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010067940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_invalid_wormhole_vaa_magic_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // Changed the magic signature to an invalid one (6064474d instead of 5054474d)
        let hex_str = "0100000000010067940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001006064474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_invalid_wormhole_vaa_random_byte_cut_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010067940f58a676869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_invalid_wormhole_vaa_invalid_version_number_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // Changed the version number to an invalid one (2 instead of 1)
        let hex_str = "0200000000010067940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_different_emitter_chain_id_than_wormhole_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // Changed the emitter chain ID to a different one (2 instead of 1)
        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000200000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_different_emitter_chain_address_than_wormhole_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // Changed the emitter chain ID to a different one (...0011 to ...0022)
        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000220000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_err(), "Invalid VAA should revert the transaction");
    }

    #[motsu::test]
    fn test_sequence_number_greater_than_last_executed_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_ok(), "This is a valid VAA, should go through");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(
            result.is_err(),
            "Cannot execute the same sequence number again, should revert"
        );
    }

    #[motsu::test]
    fn test_target_chain_id_from_ethereum_to_solana_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // This VAA is for a target chain ID of 1 (Solana), but the PythReceiver is on chain ID 2 (Ethereum)
        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000100000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(
            result.is_err(),
            "Incorrect target chain ID should revert the transaction"
        );
    }

    #[motsu::test]
    fn test_unexpected_governance_action_id_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        // Changes this action to be a SetDataSources action instead of a SetFee action
        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0102000200000000000000050000000000000003";
        let bytes = Vec::from_hex(&hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(
            result.is_err(),
            "Wrong action expected should lead to bad parsing"
        );
    }
}

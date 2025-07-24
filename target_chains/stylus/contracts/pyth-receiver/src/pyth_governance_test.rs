#[cfg(test)]
mod test {
    use crate::{DataSourcesSet, FeeSet, GovernanceDataSourceSet, PythReceiver, TransactionFeeSet};
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
    const TRANSACTION_FEE_IN_WEI: U256 = U256::from_limbs([32, 0, 0, 0]);

    const TEST_SIGNER1: Address = Address::new([
        0xbe, 0xFA, 0x42, 0x9d, 0x57, 0xcD, 0x18, 0xb7, 0xF8, 0xA4, 0xd9, 0x1A, 0x2d, 0xa9, 0xAB,
        0x4A, 0xF0, 0x5d, 0x0F, 0xBe,
    ]);
    const TEST_SIGNER2: Address = Address::new([
        0x4b, 0xa0, 0xC2, 0xdb, 0x9A, 0x26, 0x20, 0x8b, 0x3b, 0xB1, 0xa5, 0x0B, 0x01, 0xb1, 0x69,
        0x41, 0xc1, 0x0D, 0x76, 0xdb,
    ]);
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_EMITTER: [u8; 32] = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x11,
    ];
    const TEST_PYTH2_WORMHOLE_CHAIN_ID: u16 = 1;
    const TEST_PYTH2_WORMHOLE_EMITTER: [u8; 32] = [
        0x71, 0xf8, 0xdc, 0xb8, 0x63, 0xd1, 0x76, 0xe2, 0xc4, 0x20, 0xad, 0x66, 0x10, 0xcf, 0x68,
        0x73, 0x59, 0x61, 0x2b, 0x6f, 0xb3, 0x92, 0xe0, 0x64, 0x2b, 0x0c, 0xa6, 0xb1, 0xf1, 0x86,
        0xaa, 0x3b,
    ];
    const TARGET_CHAIN_ID: u16 = 2;

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

        pyth_contract.sender(*alice).initialize(
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

        let sources = vec![(1u16, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11, 0x11])];
        let bytes = crate::test_utils::create_set_data_sources_vaa(sources);

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!(
                "SetDataSources Error: {:?}",
                result.as_ref().unwrap_err()
            );
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

        //
        let bytes = crate::test_utils::create_set_valid_period_vaa(0);

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        assert!(result.is_ok(), "SetValidPeriod governance instruction should succeed");
    }


    #[motsu::test]
    fn test_set_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let bytes = crate::test_utils::create_set_fee_vaa(5, 3);

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

        let hex_str = "01000000000100b441e497034be4ee82242a866461d5e6744082654f71301a96f579f629b6bf176cc0c1964cd7d4f792436b7a73fc7024d72b138869b4d81d449740bb08148238000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01010002010000000001009c9dc62e92fefe0806dce30b662a5d319417a62dccc700b5f2678306d39c005f7a5e74d11df287301d85d328a3d000c5d793c57161f3150c7eb1a17668946e6b010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000064005054474d0105000200000000";
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

        let expected_event = GovernanceDataSourceSet {
            old_chain_id: 0, // Initial governance_data_source_index
            old_emitter_address: FixedBytes::from(GOVERNANCE_EMITTER), // Initial governance emitter from pyth_wormhole_init
            new_chain_id: 1, // claim_vm.body.emitter_chain from the VAA
            new_emitter_address: FixedBytes::from(GOVERNANCE_EMITTER), // emitter_bytes from the VAA
            initial_sequence: 100, // claim_vm.body.sequence from the VAA (0x64 = 100)
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

        let bytes = crate::test_utils::create_set_transaction_fee_vaa(100, 3);

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
}

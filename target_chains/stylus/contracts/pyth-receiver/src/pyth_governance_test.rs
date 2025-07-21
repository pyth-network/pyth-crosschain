#[cfg(test)]
mod test {
    use crate::error::PythReceiverError;
    use crate::test_data::*;
    use crate::PythReceiver;
    use alloy_primitives::{address, Address, U256};
    use hex::FromHex;
    use mock_instant::global::MockClock;
    use motsu::prelude::*;
    use pythnet_sdk::wire::v1::{AccumulatorUpdateData, Proof};
    use std::time::Duration;
    use wormhole_contract::WormholeContract;
    use wormhole_vaas::{Readable, Vaa, Writeable};

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

        let hex_str = "0100000000010069825ef00344cf745b6e72a41d4f869d4e90de517849360c72bf94efc97681671d826e484747b21a80c8f1e7816021df9f55e458a6e7a717cb2bd2a1e85fd57100499602d200000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010200020100010000000000000000000000000000000000000000000000000000000000001111";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_set_valid_period(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "010000000001006fc16df905b08c16553eda9d5a7898ec7eba4267ce0af7945625c955e8f435fc7df7a4087af360f88c2477f0c2f4e7eaa4bb1e8fd43677f4d6b04ee20e225186000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010400020000000000000000";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());

        println!("Result: {:?}", result.unwrap_err());
        // assert!(result.is_ok());
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
        // println!("Result: {:?}", result.unwrap_err());
    }

    #[motsu::test]
    fn test_set_fee_in_token(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000025005054474d0107000200000000000000050000000000000003147e5f4552091a69125d5dfcb7b8c2659029395bdf";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_set_wormhole_address(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed00000000010000000000010000000000000000000000000000000000000000000000000000000000000011000000000000001a005054474d010600027e5f4552091a69125d5dfcb7b8c2659029395bdf";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("SetWormholeAddress Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_authorize_governance_data_source_transfer(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000070005054474d0101000201000000000100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000008005054474d010500020000000000000001";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("AuthorizeGovernanceDataSourceTransfer Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_set_transaction_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000018005054474d010800020000000000000064000000000000000003";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("SetTransactionFee Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_withdraw_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice, 0);

        let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed00000000010000000000010000000000000000000000000000000000000000000000000000000000000011000000000000002a005054474d0109000200be7e5f4552091a69125d5dfcb7b8c2659029395bdf00000000000000640000000000000003";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract
            .sender(alice)
            .execute_governance_instruction(bytes.clone());
        if result.is_err() {
            println!("WithdrawFee Error: {:?}", result.as_ref().unwrap_err());
        }
        assert!(result.is_ok());
    }
}

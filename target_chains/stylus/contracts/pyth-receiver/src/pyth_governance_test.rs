#[cfg(test)]
mod test {
    use crate::error::PythReceiverError;
    use crate::test_data::*;
    use crate::PythReceiver;
    use alloy_primitives::{Address, U256};
    use mock_instant::global::MockClock;
    use motsu::prelude::*;
    use pythnet_sdk::wire::v1::{AccumulatorUpdateData, Proof};
    use std::time::Duration;
    use hex::FromHex;
    use wormhole_contract::WormholeContract;

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    const SINGLE_UPDATE_FEE_IN_WEI: U256 = U256::from_limbs([100, 0, 0, 0]);
    const TRANSACTION_FEE_IN_WEI: U256 = U256::from_limbs([32, 0, 0, 0]);
    
    const TEST_SIGNER1: Address = Address::from_slice(&Vec::from_hex("beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe").expect("Invalid hex for TEST_SIGNER1"));
    const TEST_SIGNER2: Address = Address::from_slice(&Vec::from_hex("4ba0C2db9A26208b3bB1a50B01b16941c10D76db").expect("Invalid hex for TEST_SIGNER2"));
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_EMITTER: [u8; 32] = {
        let v = Vec::from_hex("0000000000000000000000000000000000000000000000000000000000000011").expect("Invalid hex for GOVERNANCE_EMITTER");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&v);
        arr
    };
    const TEST_PYTH2_WORMHOLE_CHAIN_ID: u16 = 1;
    const TEST_PYTH2_WORMHOLE_EMITTER: [u8; 32] = {
        let v = Vec::from_hex("71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b").expect("Invalid hex for TEST_PYTH2_WORMHOLE_EMITTER");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&v);
        arr
    };
    const TARGET_CHAIN_ID: u16 = 2;

    #[cfg(test)]
    fn pyth_wormhole_init(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(*alice)
            .initialize(
                guardians,
                4,
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
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let old_data_sources = vec![PYTHNET_CHAIN_ID];

        let hex_str = "01000000000100a53d7675143a514fa10756ef19e1281648aec03be2ea071c139f241839cb01206ce5c7f3673fc446a045cab2d4f97ef0de01de70269ab2678bba76b41c3a60ce010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010200020100010000000000000000000000000000000000000000000000000000000000001111";
        let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");

        let result = pyth_contract.sender(alice).execute_governance_instruction(bytes);
        assert!(result.is_ok());
    }

}
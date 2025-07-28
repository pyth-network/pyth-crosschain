#[cfg(test)]
mod proxy_tests {
    use crate::PythReceiver;
    use alloy_primitives::{address, Address, U256};
    use motsu::prelude::*;
    use wormhole_contract::WormholeContract;

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);
    const SINGLE_UPDATE_FEE_IN_WEI: U256 = U256::from_limbs([100, 0, 0, 0]);

    const ALICE: Address = address!("beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe");

    fn init_contracts(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
    ) {
        let initial_guardians = vec![*alice];
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        
        wormhole_contract
            .sender(*alice)
            .initialize(
                initial_guardians,
                0,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

        pyth_contract
            .sender(*alice)
            .initialize(
                wormhole_contract.address(),
                SINGLE_UPDATE_FEE_IN_WEI,
                U256::from(60),
                vec![PYTHNET_CHAIN_ID],
                vec![PYTHNET_EMITTER_ADDRESS],
                PYTHNET_CHAIN_ID,
                PYTHNET_EMITTER_ADDRESS,
                0,
            )
            .unwrap();
    }

    #[motsu::test]
    fn test_pyth_receiver_initialization(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        init_contracts(&pyth_contract, &wormhole_contract, &alice);
        assert!(pyth_contract.sender(alice).is_initialized(), "Contract should be initialized");
    }

    #[motsu::test]
    fn test_pyth_receiver_price_feed_functionality(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        init_contracts(&pyth_contract, &wormhole_contract, &alice);
        
        let test_id = [1u8; 32];
        let exists = pyth_contract.sender(alice).price_feed_exists(test_id);
        assert!(!exists, "Price feed should not exist initially");
        
        let price_result = pyth_contract.sender(alice).get_price_unsafe(test_id);
        assert!(price_result.is_err(), "Getting non-existent price should fail");
    }

    #[motsu::test]
    fn test_pyth_receiver_query_price_feed(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        init_contracts(&pyth_contract, &wormhole_contract, &alice);
        
        let test_id = [2u8; 32];
        let query_result = pyth_contract.sender(alice).query_price_feed(test_id);
        assert!(query_result.is_err(), "Querying non-existent price feed should fail");
    }
}

#[cfg(test)]
mod end_to_end_proxy_tests {
    use crate::Proxy;
    use alloy_primitives::{address, Address, FixedBytes, U256};
    use alloy_sol_types::{sol, SolCall};
    use motsu::prelude::*;
    use pyth_receiver_stylus::PythReceiver;
    use wormhole_contract::WormholeContract;
    use pythnet_sdk::wire::v1::{AccumulatorUpdateData, Proof};

    sol! {
        function getPriceUnsafe(uint8[32] calldata id) external view returns (int64,uint64,int32,uint64);
        function updatePriceFeeds(uint8[][] memory update_data) external payable;
        function queryPriceFeed(uint8[32] calldata id) external view returns (bytes32,uint64,int32,int64,uint64,int64,uint64);
        function priceFeedExists(uint8[32] calldata id) external view returns (bool);
    }

    const OWNER: Address = address!("beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe");
    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const SINGLE_UPDATE_FEE_IN_WEI: U256 = U256::from_limbs([100, 0, 0, 0]);
    const TRANSACTION_FEE_IN_WEI: U256 = U256::from_limbs([32, 0, 0, 0]);

    fn mock_get_update_fee(update_data: Vec<Vec<u8>>) -> Result<U256, Vec<u8>> {
        let mut total_num_updates: u64 = 0;
        for data in &update_data {
            let update_data_array: &[u8] = &data;
            let accumulator_update = AccumulatorUpdateData::try_from_slice(&update_data_array)
                .map_err(|_| b"Invalid accumulator message".to_vec())?;
            match accumulator_update.proof {
                Proof::WormholeMerkle { vaa: _, updates } => {
                    let num_updates = u64::try_from(updates.len())
                        .map_err(|_| b"Too many updates".to_vec())?;
                    total_num_updates += num_updates;
                }
            }
        }
        Ok(U256::from(total_num_updates).saturating_mul(SINGLE_UPDATE_FEE_IN_WEI) + TRANSACTION_FEE_IN_WEI)
    }

    fn ban_usd_feed_id() -> [u8; 32] {
        let hex_string = "a6320c8329924601f4d092dd3f562376f657fa0b5d0cba9e4385a24aaf135384";
        let bytes_vec = hex::decode(hex_string).expect("Invalid hex string");
        bytes_vec.try_into().expect("Hex string must decode to exactly 32 bytes")
    }

    fn ban_usd_update() -> Vec<Vec<u8>> {
        let hex_str = "504e41550100000003b801000000040d01c9e767c1685410aa1ad3a221af6d257b01d98301b27b72e78f3d7a8d580a90127451c5c699cbb1ef0b5bfd57645456c2898a997ccd4de6eb79d277ce56a12d0b01027599b2f2450d4d59904dc8f738dd73825db0b5235707b9f44119a84e8632c460652e5d7b3ba142120f2510374a478bd7e5cd71b954cae9ef6ea15d7a08a1c3e90103f3a1bd74938fa7c6b2c917303a002474a5f716501c19789fece2a3f80bd05c457c8087a8b2d14e84762059daa5608e38e4e3e8ed572787a20100b8c1d69777f30104c5640a58148caeab59ed9dcc025f7b7dcdeecbfc51108cc29d3659e8b0a1c1aa4079f43e0e846ed353d45b5f436431096cd3094c2fa15e4920e2d35e33632e00010693790cbfaca431837658775a3b274c05676b272b916245f939e978789874ce0f2daa426325986f38c2ee3b9053008362b60b9851d2e9db69d718faddb96db68700098eafe76c684d04f99292d536de3e95eb446c3fac2f70aaac11d5dbda0b5a38f516b56e9f3472528b675337746653c59ed2eae9079ae7f59c004a8cbb40139a7a010ae14fce0cc71f738ec21e66edcd867db036cd5e11a9476c710d2457e025c035c84518c8750b17197d308b9faa2561ec6532c2266eb36723a9d11871b04e3b1138000ba68cde478a18ebbc8e9c2b4bbb4ff16803d5402efbdc9fc34cad9d9ed6f1609f6c81596fac2eed2b98ce6f5b5d7efba530c8b9c15c70f2f10898b38ea2f9978c000d2ecb926686379023572b64d78aef7f61e9aa3e4ceae1d2b2917c1fae6d112b3d7ad1597e6768fffa2dff61a62012562eb68a7cf5597e9bfe755c280df36aef2c000e293c5cb9c805665057bedcfeae74139f47cb5cddc4d5190bbddc4d12cd53caa972281394ac02759b860382da06e8d9b003285090a6783de21786dfcb3b669c58000f3b90618d7a63cdd7da9e730dbd0bf5b22acdc35c08a17c9a6728b1115e63ff837c3267452dc29d8f77fa0cd39428066ea8ae1fd086293e2f17b9421b59f7922f0010629f08a3a59d8187eefef92a54b9bf55fb676f4e9fea826ffb4aa3331155c2162315bd092dd01776f0e45c5d857f9de70a0cbfa9b33f96d8c752bed5c37cf05600113038bf5593427383bfd0966064dc43f7a84f8c083c1bc1b03aa24fc857008f057778ca2393ac1146bbb51588f4903f0822cb94ac0dce7cdcba3a207969d529d000687028bf00000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71000000000897d17f014155575600000000000da5600300002710bb2be176a294375c4430a694c2813c5823a56bef01005500a6320c8329924601f4d092dd3f562376f657fa0b5d0cba9e4385a24aaf1353840000000000625bef0000000000003c63fffffff800000000687028bf00000000687028bf00000000006223710000000000003c6b0c299b70feaac0e02b6430892ee820e1a0706a4099acf41781c8fa57ba6ca1f0b62d98994ccecb7d465eeae1c5a236df5ea50768f1d8e9300500a8824e608c5a02572ee89aa0f0490bd64d60482516a17a2cf6ef3140ac5e35e3ee1844aeb2fb2ab7740ed0905f80725663f8a7018025ea163ece851177137f0e1012b32a540bbaedd2be2b7ecbb6d7baa37298d5ea1e7d8b6c3e3f3c40ec0cdc546dcac1fc8fd0f16828f8d3d948e4ab67391bbca60a63de48273df382ca02f05bd3aa8a0f7513f2a722bd447d8c07a02e73f14d9bb625e82aea434b9378ffba62dd0ef4d04875b1a31cc077b7a9c58ddd0109e4b67e45";
        let bytes = hex::decode(hex_str).expect("Invalid hex string");
        vec![bytes]
    }

    fn setup_proxy_with_receiver(
        proxy: &Contract<Proxy>,
        receiver: &Contract<PythReceiver>,
        wormhole: &Contract<WormholeContract>,
        alice: &Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        proxy.sender(OWNER).set_implementation(receiver.address()).unwrap();

        let initial_guardians = vec![*alice];
        let governance_contract = Address::from_slice(&U256::from(4u64).to_be_bytes::<32>()[12..32]);
        wormhole.sender(*alice).initialize(
            initial_guardians, 4, 60051u16, 1u16, governance_contract
        ).unwrap();

        receiver.sender(*alice).initialize(
            wormhole.address(),
            SINGLE_UPDATE_FEE_IN_WEI, // single_update_fee
            U256::from(3600u64),  // valid_time_period
            vec![PYTHNET_CHAIN_ID],        // data_source_chain_ids
            vec![PYTHNET_EMITTER_ADDRESS], // emitter_addresses
            1u16,              // governance_chain_id
            [3u8; 32],       // governance_emitter_address
            0u64,                          // governance_initial_sequence
        ).unwrap();
    }

    #[motsu::test]
    fn test_get_price_unsafe_through_proxy(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        let direct_result = receiver.sender(alice).get_price_unsafe(test_id);
        assert!(direct_result.is_err(), "Direct call should fail with no price data");

        let call_data = getPriceUnsafeCall::new((test_id,)).abi_encode();
        let proxy_result = proxy.sender(OWNER).relay_to_implementation(call_data);
        
        assert!(proxy_result.is_err(), "Proxy call should also fail with no price data");
        
        assert!(proxy_result.is_err() && direct_result.is_err(), 
                "Both direct and proxy calls should fail consistently");
    }

    #[motsu::test]
    fn test_price_feed_exists_through_proxy(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        let direct_exists = receiver.sender(alice).price_feed_exists(test_id);
        assert!(!direct_exists, "Price feed should not exist initially");

        let call_data = priceFeedExistsCall::new((test_id,)).abi_encode();
        let proxy_result = proxy.sender(OWNER).relay_to_implementation(call_data);
        
        if proxy_result.is_err() {
            println!("Proxy delegation error: {:?}", proxy_result.as_ref().unwrap_err());
        }
        assert!(proxy_result.is_ok(), "Proxy call should succeed");
        
        let result_bytes = proxy_result.unwrap();
        let decoded_result = result_bytes.len() > 0 && result_bytes[result_bytes.len() - 1] != 0;
        assert!(!decoded_result, "Both should return false (no price feed exists)");
    }

    #[motsu::test]
    fn test_update_price_feeds_through_proxy(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let update_data = ban_usd_update();
        let update_data_bytes: Vec<Vec<u8>> = update_data;
        
        let call_data = updatePriceFeedsCall::new((update_data_bytes.clone(),)).abi_encode();
        let proxy_result = proxy.sender(OWNER).relay_to_implementation(call_data);
        
        assert!(proxy_result.is_err(), "Proxy call should fail due to insufficient fee");
        
        let direct_result = receiver.sender(alice).update_price_feeds(update_data_bytes.clone());
        assert!(direct_result.is_err(), "Direct call should also fail with insufficient fee");
    }

    #[motsu::test]
    fn test_complete_proxy_delegation_workflow(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        let exists_call = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result = proxy.sender(OWNER).relay_to_implementation(exists_call);
        
        if exists_result.is_err() {
            println!("Proxy delegation error for exists_call: {:?}", exists_result.as_ref().unwrap_err());
        }
        assert!(exists_result.is_ok(), "Price feed exists check should work through proxy");

        let price_call = getPriceUnsafeCall::new((test_id,)).abi_encode();
        let price_result = proxy.sender(OWNER).relay_to_implementation(price_call);
        assert!(price_result.is_err(), "Get price should fail when no data exists");

        assert_eq!(proxy.sender(alice).get_implementation().unwrap(), receiver.address());
        assert_eq!(proxy.sender(alice).get_owner(), OWNER);
        assert!(proxy.sender(alice).is_initialized());
        
        println!("Proxy delegation workflow test completed successfully");
    }

    #[motsu::test]
    fn test_proxy_initialization_and_setup(
        proxy: Contract<Proxy>,
        implementation: Contract<PythReceiver>,
        alice: Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        assert!(proxy.sender(alice).is_initialized(), "Proxy should be initialized");
        assert_eq!(proxy.sender(alice).get_owner(), OWNER, "Proxy should have correct owner");
        
        proxy.sender(OWNER).set_implementation(implementation.address()).unwrap();
        assert_eq!(proxy.sender(alice).get_implementation().unwrap(), implementation.address(), "Implementation should be set correctly");
    }

    #[motsu::test] 
    fn test_proxy_upgrade_workflow(
        proxy: Contract<Proxy>,
        implementation1: Contract<PythReceiver>,
        implementation2: Contract<PythReceiver>,
        alice: Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        proxy.sender(OWNER).set_implementation(implementation1.address()).unwrap();
        
        assert_eq!(proxy.sender(alice).get_implementation().unwrap(), implementation1.address(), "First implementation should be set");
        
        proxy.sender(OWNER).set_implementation(implementation2.address()).unwrap();
        
        assert_eq!(proxy.sender(alice).get_implementation().unwrap(), implementation2.address(), "Should upgrade to second implementation");
    }

    #[motsu::test]
    fn test_proxy_access_control(
        proxy: Contract<Proxy>,
        implementation: Contract<PythReceiver>,
        alice: Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let non_owner_result = proxy.sender(alice).set_implementation(implementation.address());
        assert!(non_owner_result.is_err(), "Non-owner should not be able to set implementation");
        
        let owner_result = proxy.sender(OWNER).set_implementation(implementation.address());
        assert!(owner_result.is_ok(), "Owner should be able to set implementation");
    }

    #[motsu::test]
    fn test_proxy_validation_checks(
        proxy: Contract<Proxy>,
        alice: Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let zero_impl_result = proxy.sender(OWNER).set_implementation(Address::ZERO);
        assert!(zero_impl_result.is_err(), "Should not allow zero address as implementation");
        
        let double_init_result = proxy.sender(OWNER).init(OWNER);
        assert!(double_init_result.is_err(), "Should not allow double initialization");
        
        let uninitialized_proxy = Contract::<Proxy>::new();
        let get_impl_result = uninitialized_proxy.sender(alice).get_implementation();
        assert!(get_impl_result.is_err(), "Should fail to get implementation when not set");
    }

    #[motsu::test]
    fn test_proxy_state_persistence(
        proxy: Contract<Proxy>,
        implementation: Contract<PythReceiver>,
        alice: Address,
    ) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        proxy.sender(OWNER).set_implementation(implementation.address()).unwrap();
        
        let owner1 = proxy.sender(alice).get_owner();
        let impl1 = proxy.sender(alice).get_implementation().unwrap();
        let init1 = proxy.sender(alice).is_initialized();
        
        let owner2 = proxy.sender(alice).get_owner();
        let impl2 = proxy.sender(alice).get_implementation().unwrap();
        let init2 = proxy.sender(alice).is_initialized();
        
        assert_eq!(owner1, owner2, "Owner should persist across calls");
        assert_eq!(impl1, impl2, "Implementation should persist across calls");
        assert_eq!(init1, init2, "Initialization state should persist across calls");
    }

    #[motsu::test]
    fn test_successful_proxy_delegation_for_read_operations(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        let exists_call = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result = proxy.sender(OWNER).relay_to_implementation(exists_call);
        assert!(exists_result.is_ok(), "Price feed exists check should work through proxy");
        
        let result_bytes = exists_result.unwrap();
        assert!(!result_bytes.is_empty(), "Result should not be empty");
        let feed_exists = result_bytes.len() > 0 && result_bytes[result_bytes.len() - 1] != 0;
        assert!(!feed_exists, "Feed should not exist initially (expected behavior)");

        let price_call = getPriceUnsafeCall::new((test_id,)).abi_encode();
        let price_result = proxy.sender(OWNER).relay_to_implementation(price_call);
        assert!(price_result.is_err(), "Get price should fail when no data exists (expected behavior)");

        println!("Successfully delegated read operations through proxy with expected results");
    }

    #[motsu::test]
    fn test_successful_proxy_function_selector_matching(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        
        let exists_call = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result = proxy.sender(OWNER).relay_to_implementation(exists_call);
        assert!(exists_result.is_ok(), "priceFeedExists function selector should be found and delegated");
        
        let query_call = queryPriceFeedCall::new((test_id,)).abi_encode();
        let query_result = proxy.sender(OWNER).relay_to_implementation(query_call);
        if query_result.is_err() {
            println!("queryPriceFeed error: {:?}", query_result.as_ref().unwrap_err());
        }
        let is_selector_error = if let Err(ref err_bytes) = query_result {
            let err_str = String::from_utf8_lossy(err_bytes);
            err_str.contains("function not found for selector")
        } else {
            false
        };
        assert!(!is_selector_error, "queryPriceFeed function selector should be found (even if call fails for other reasons)");
        
        let price_call = getPriceUnsafeCall::new((test_id,)).abi_encode();
        let price_result = proxy.sender(OWNER).relay_to_implementation(price_call);
        assert!(price_result.is_err(), "getPriceUnsafe should be delegated but fail due to no data");
        
        println!("Successfully verified all function selectors are correctly matched and delegated");
    }

    #[motsu::test]
    fn test_successful_proxy_state_consistency(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        
        let exists_call1 = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result1 = proxy.sender(OWNER).relay_to_implementation(exists_call1);
        assert!(exists_result1.is_ok(), "First priceFeedExists call should succeed");
        let result1 = exists_result1.unwrap();
        
        let exists_call2 = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result2 = proxy.sender(OWNER).relay_to_implementation(exists_call2);
        assert!(exists_result2.is_ok(), "Second priceFeedExists call should succeed");
        let result2 = exists_result2.unwrap();
        
        assert_eq!(result1, result2, "Consecutive calls should return identical results");
        
        let query_call = queryPriceFeedCall::new((test_id,)).abi_encode();
        let query_result = proxy.sender(OWNER).relay_to_implementation(query_call);
        if query_result.is_err() {
            println!("queryPriceFeed error in state consistency test: {:?}", query_result.as_ref().unwrap_err());
        }
        let is_selector_error = if let Err(ref err_bytes) = query_result {
            let err_str = String::from_utf8_lossy(err_bytes);
            err_str.contains("function not found for selector")
        } else {
            false
        };
        assert!(!is_selector_error, "queryPriceFeed function selector should be found in state consistency test");
        
        let exists_call3 = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result3 = proxy.sender(OWNER).relay_to_implementation(exists_call3);
        assert!(exists_result3.is_ok(), "Third priceFeedExists call should succeed");
        let result3 = exists_result3.unwrap();
        
        assert_eq!(result1, result3, "State should remain consistent across different function calls");
        
        println!("Successfully verified proxy state consistency across multiple delegated calls");
    }

    #[motsu::test]
    fn test_successful_price_update_through_proxy(
        proxy: Contract<Proxy>,
        receiver: Contract<PythReceiver>,
        wormhole: Contract<WormholeContract>,
        alice: Address,
    ) {
        setup_proxy_with_receiver(&proxy, &receiver, &wormhole, &alice);

        let test_id = ban_usd_feed_id();
        
        let exists_call = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result = proxy.sender(OWNER).relay_to_implementation(exists_call);
        assert!(exists_result.is_ok(), "Price feed exists check should work through proxy");
        let result_bytes = exists_result.unwrap();
        let feed_exists = result_bytes.len() > 0 && result_bytes[result_bytes.len() - 1] != 0;
        assert!(!feed_exists, "Feed should not exist initially");

        let update_data = ban_usd_update();
        let update_data_bytes: Vec<Vec<u8>> = update_data;
        let update_fee = mock_get_update_fee(update_data_bytes.clone()).unwrap();
        
        println!("Calculated update fee: {:?}", update_fee);
        println!("Update data length: {}", update_data_bytes.len());
        
        alice.fund(update_fee);
        
        let call_data = updatePriceFeedsCall::new((update_data_bytes.clone(),)).abi_encode();
        let proxy_result = proxy.sender_and_value(alice, update_fee).relay_to_implementation(call_data);
        
        if proxy_result.is_err() {
            println!("Proxy price update error: {:?}", proxy_result.as_ref().unwrap_err());
        }
        assert!(proxy_result.is_ok(), "Price update through proxy should succeed with proper fee");
        
        let exists_call2 = priceFeedExistsCall::new((test_id,)).abi_encode();
        let exists_result2 = proxy.sender(OWNER).relay_to_implementation(exists_call2);
        assert!(exists_result2.is_ok(), "Price feed exists check should work after update");
        let result_bytes2 = exists_result2.unwrap();
        let feed_exists2 = result_bytes2.len() > 0 && result_bytes2[result_bytes2.len() - 1] != 0;
        assert!(feed_exists2, "Feed should exist after successful update");
        
        let price_call = getPriceUnsafeCall::new((test_id,)).abi_encode();
        let price_result = proxy.sender(alice).relay_to_implementation(price_call);
        assert!(price_result.is_ok(), "Should be able to get price after successful update");
        
        println!("Successfully updated price feeds through proxy with proper fee payment");
    }
}

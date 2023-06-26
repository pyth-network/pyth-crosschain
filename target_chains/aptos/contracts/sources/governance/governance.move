module pyth::governance {
    use wormhole::vaa::{Self, VAA};
    use pyth::data_source::{Self};
    use wormhole::u16;
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::error;
    use pyth::set_update_fee;
    use pyth::state;

    public entry fun execute_governance_instruction(vaa_bytes: vector<u8>) {
        let parsed_vaa = parse_and_verify_governance_vaa(vaa_bytes);
        let instruction = governance_instruction::from_byte_vec(vaa::destroy(parsed_vaa));

        // Dispatch the instruction to the appropiate handler
        let action = governance_instruction::get_action(&instruction);
        if (action == governance_action::new_contract_upgrade()) {
            assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
                error::governance_contract_upgrade_chain_id_zero());
            contract_upgrade::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_governance_data_source()) {
            set_governance_data_source::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_data_sources()) {
            set_data_sources::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_update_fee()) {
            set_update_fee::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_stale_price_threshold()) {
            set_stale_price_threshold::execute(governance_instruction::destroy(instruction));
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, error::invalid_governance_action());
        }
    }

    fun parse_and_verify_governance_vaa(bytes: vector<u8>): VAA {
        let parsed_vaa = vaa::parse_and_verify(bytes);

        // Check that the governance data source is valid
        assert!(
            state::is_valid_governance_data_source(
                data_source::new(
                    u16::to_u64(vaa::get_emitter_chain(&parsed_vaa)),
                    vaa::get_emitter_address(&parsed_vaa))),
            error::invalid_governance_data_source());

        // Check that the sequence number is greater than the last executed governance VAA
        let sequence = vaa::get_sequence(&parsed_vaa);
        assert!(sequence > state::get_last_executed_governance_sequence(), error::invalid_governance_sequence_number());
        state::set_last_executed_governance_sequence(sequence);

        parsed_vaa
    }
}

#[test_only]
module pyth::governance_test {
    use pyth::data_source::{Self, DataSource};
    use pyth::pyth;
    use pyth::governance;
    use pyth::contract_upgrade_hash;
    use pyth::state;
    use wormhole::external_address;
    use std::account;
    use std::vector;

    #[test_only]
    fun setup_test(
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        update_fee: u64,
    ) {
        // Initialize wormhole with a large message collection fee
        wormhole::wormhole_test::setup(100000);

        // Deploy and initialize a test instance of the Pyth contract
        let deployer = account::create_signer_with_capability(&
            account::create_test_signer_cap(@0x277fa055b6a73c42c0662d5236c65c864ccbf2d4abd21f174a30c8b786eab84b));
        let (_pyth, signer_capability) = account::create_resource_account(&deployer, b"pyth");
        pyth::init_test(signer_capability, stale_price_threshold, governance_emitter_chain_id, governance_emitter_address, vector[], update_fee);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = wormhole::vaa)]
    fun test_execute_governance_instruction_invalid_vaa() {
        setup_test(50, 24, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);
        let vaa_bytes = x"6c436741b108";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65550, location = pyth::governance)]
    fun test_execute_governance_instruction_invalid_data_source() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID of 20
        // - Emitter address of 0xed67fcc21620d1bf9f69db61ea65ea36ae2df4f86c8e1b9503f0da287c24ed41
        let vaa_bytes = x"0100000000010066359039306c20c8e6d0047ca82aef1b3d1059a3196ab9b21ee9eb8d8438c4e06c3f181d86687cf52f8c4a167ce8af6a5dbadad22253a4016dc28a25f181a37301527e4f9b000000010014ed67fcc21620d1bf9f69db61ea65ea36ae2df4f86c8e1b9503f0da287c24ed410000000000000000005054474eb01087a85361f738f19454e66664d3c9";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65551, location = pyth::governance)]
    fun test_execute_governance_instruction_invalid_sequence_number_0() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);
        assert!(state::get_last_executed_governance_sequence() == 0, 1);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 0
        let vaa_bytes = x"010000000001004d7facf7151ada96a35a3f099843c5f13bd0e0a6cbf50722d4e456d370bbce8641ecc16450979d4c403888f9f08d5975503d810732dc95575880d2a4c64d40aa01527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000000005054474eb01087a85361f738f19454e66664d3c9";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65556, location = pyth::governance_instruction)]
    fun test_execute_governance_instruction_invalid_instruction_magic() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload with the value x"5054474eb01087a85361f738f19454e66664d3c9", so the magic number will be 5054474e
        let vaa_bytes = x"01000000000100583334c65aff30780bf7f2ac783398a2a985e3e4873264e46c3cddfdfb2eaa484365e9f4a3ecc14d059ac1cf0a7b6a58075749ad17a3bfd4153d8f45b9084a3500527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474eb01087a85361f738f19454e66664d3c9";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65548, location = pyth::governance_instruction)]
    fun test_execute_governance_instruction_invalid_module() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 2
        let vaa_bytes = x"010000000001001d9fd73b3fb0fc522eae5eb5bd40ddf68941894495d7cec8c8efdbf462e48715171b5c6d4bbca0c1e3843b3c28d0ca6f3f76874624b5595a3a2cbfdb3907b62501527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0202001003001793a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d000c9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b00012f7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65549, location = pyth::governance_instruction)]
    fun test_execute_governance_instruction_invalid_target_chain() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 17 != wormhole test chain ID 22
        let vaa_bytes = x"010000000001001ed81e10f8e52e6a7daeca12bf0859c14e8dabed737eaed9a1f8227190a9d11c48d58856713243c5d7de08ed49de4aa1efe7c5e6020c11056802e2d702aa4b2e00527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0102001103001793a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d000c9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b00012f7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65552, location = pyth::governance_action)]
    fun test_execute_governance_instruction_invalid_action() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - Action 19 (invalid)
        let vaa_bytes = x"0100000000010049fdadd56a51e8bd30637dbf9fc79a154a80c96479ce223061ec1f5094f2908715d6c691e5f06068873daa79c87fc25deb62555db7c520468d05aa2437fda97201527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0113001603001793a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d000c9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b00012f7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35";
        governance::execute_governance_instruction(vaa_bytes);
    }

    #[test]
    fun test_execute_governance_instruction_upgrade_contract() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 5
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - AuthorizeContractUpgrade {
        //         hash: 0xa381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56,
        //     }
        let vaa_bytes = x"010000000001002242229aec7d320a437cb241672dacfbc34c9155c02f60cd806bbfcd69bb7ba667fc069e372ae0443a7f3e08eaad61930b00784faeb2b72ecf5d1b0f0fa486a101527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000005005054474d01000016a381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56";

        governance::execute_governance_instruction(vaa_bytes);
        assert!(state::get_last_executed_governance_sequence() == 5, 1);

        assert!(state::get_contract_upgrade_authorized_hash() ==
            contract_upgrade_hash::from_byte_vec(x"a381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56"), 1);
    }

    #[test]
    #[expected_failure(abort_code = 65558, location = pyth::governance)]
    fun test_execute_governance_instruction_upgrade_contract_chain_id_zero() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 5
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 0
        //   - AuthorizeContractUpgrade {
        //         hash: 0xa381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56,
        //     }
        let vaa_bytes = x"01000000000100303c10020c537205ed0322b7ec9d9b296f4e3e12e39ebde985ed4ef4c8f5565256cfc6f90800c4683dba62b577cc994e2ca9135d32b955040b94718cdcb5527600527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000005005054474d01000000a381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56";

        governance::execute_governance_instruction(vaa_bytes);
        assert!(state::get_last_executed_governance_sequence() == 5, 1);

        assert!(state::get_contract_upgrade_authorized_hash() ==
            contract_upgrade_hash::from_byte_vec(x"a381a47fd0e97f34c71ef491c82208f58cd0080e784c697e65966d2a25d20d56"), 1);
    }

    #[test]
    fun test_execute_governance_instruction_set_governance_data_source() {
        let initial_governance_emitter_chain_id = 50;
        let initial_governance_emitter_address = x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf";
        setup_test(100, initial_governance_emitter_chain_id, initial_governance_emitter_address, 100);

        state::set_last_executed_governance_sequence(25);

        let initial_governance_data_source = data_source::new(initial_governance_emitter_chain_id, external_address::from_bytes(initial_governance_emitter_address));
        assert!(state::is_valid_governance_data_source(initial_governance_data_source), 1);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 27
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetGovernanceDataSource {
        //         emitter_chain_id: 9,
        //         emitter_address: 0x625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058,
        //         initial_sequence: 10,
        //     }
        let vaa_bytes = x"01000000000100e8ce9e581b64ab7fbe168a0d9f86d1d2220e57947fb0c75174849838104d5fdf39ceb52ca44706bbe2817e6d33dd84ff92dc13ffe024578722178602ffd1775b01527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf000000000000001b005054474d010100160009625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058000000000000000a";

        governance::execute_governance_instruction(vaa_bytes);

        // Check that the governance data source and sequence number has been updated correctly
        assert!(state::get_last_executed_governance_sequence() == 10, 1);
        assert!(!state::is_valid_governance_data_source(initial_governance_data_source), 1);
        assert!(state::is_valid_governance_data_source(
            data_source::new(9, external_address::from_bytes(x"625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058")
        )), 1);

        // Check that we can successfully execute a governance VAA from the new governance data source
        // A VAA with:
        // - Emitter chain ID 9
        // - Emitter address 0x625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058
        // - Sequence number 15
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetStalePriceThreshold {
        //         threshold: 900
        //     }
        let second_vaa_bytes = x"010000000001008df31b9853fe9f49b1949b66e10795595c37dfc5dede5ea15c1d136cc104843e2048488dfffc3d791ac1c11c71cdb7b73f250b00eb6977cd80e943542142c3a500527e4f9b000000010009625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058000000000000000f005054474d010400160000000000000384";
        governance::execute_governance_instruction(second_vaa_bytes);

        assert!(state::get_last_executed_governance_sequence() == 15, 1);
        assert!(state::get_stale_price_threshold_secs() == 900, 1);
    }

    #[test]
    #[expected_failure(abort_code = 65550, location = pyth::governance)]
    fun test_execute_governance_instruction_set_governance_data_source_old_source_invalid() {
        let initial_governance_emitter_chain_id = 50;
        let initial_governance_emitter_address = x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf";
        setup_test(100, initial_governance_emitter_chain_id, initial_governance_emitter_address, 100);

        state::set_last_executed_governance_sequence(25);

        let initial_governance_data_source = data_source::new(initial_governance_emitter_chain_id, external_address::from_bytes(initial_governance_emitter_address));
        assert!(state::is_valid_governance_data_source(initial_governance_data_source), 1);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf"
        // - Sequence number 27
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetGovernanceDataSource {
        //         emitter_chain_id: 9,
        //         emitter_address: 0x625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058,
        //         initial_sequence: 10,
        //     }
        let vaa_bytes = x"01000000000100e8ce9e581b64ab7fbe168a0d9f86d1d2220e57947fb0c75174849838104d5fdf39ceb52ca44706bbe2817e6d33dd84ff92dc13ffe024578722178602ffd1775b01527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf000000000000001b005054474d010100160009625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058000000000000000a";

        governance::execute_governance_instruction(vaa_bytes);

        // Check that the governance data source and sequence number has been updated correctly
        assert!(state::get_last_executed_governance_sequence() == 10, 1);
        assert!(!state::is_valid_governance_data_source(initial_governance_data_source), 1);
        assert!(state::is_valid_governance_data_source(
            data_source::new(9, external_address::from_bytes(x"625bae57728a368652a0ab0a89808de5fffa61d3312f1a27c3e200e99b1f3058")
        )), 1);

        // Check that we can not longer execute governance VAA's from the old governance data source
        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 30
        let second_vaa_bytes = x"010000000001000e2670b14d716673d44f3766684a42a55c49feaf9a38acffb6971ec66fee2a211e7260413ccf4e3de608111dc0b92a131e8c9b8f5e83e6c36d5fc2228e46eb2d01527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf000000000000001e005054474d010400160000000000000384";
        governance::execute_governance_instruction(second_vaa_bytes);
    }

    #[test]
    fun test_execute_governance_instruction_set_update_fee() {
        let initial_update_fee = 325;
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", initial_update_fee);
        assert!(state::get_base_update_fee() == initial_update_fee, 1);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetUpdateFee {
        //         mantissa: 17,
        //         exponent: 3,
        //     }
        let vaa_bytes = x"010000000001009f843a3359e75940cad00eaec50a1ac075aca3248634576437cfd53d95c2e29859a3a1902a3ef3e0529b434cf63ce96b21e4e6c05204ba62a446371aa132174000527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0103001600000000000000110000000000000003";

        governance::execute_governance_instruction(vaa_bytes);
        assert!(state::get_last_executed_governance_sequence() == 1, 1);

        let expected = 17000;
        assert!(state::get_base_update_fee() == expected, 1);
    }

    #[test]
    fun test_execute_governance_instruction_set_stale_price_threshold() {
        let initial_stale_price_threshold = 125;
        setup_test(initial_stale_price_threshold, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);
        assert!(state::get_stale_price_threshold_secs() == initial_stale_price_threshold, 1);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetStalePriceThreshold {
        //         threshold: 756
        //     }
        let vaa_bytes = x"01000000000100e863ad8824f2c2a1695c6b028fa36c5f654b5f3e8d33712032aa3a2197329f3e2c59fc86cc026e6c68608d9e13982f2a22098bbc877ae2b106f6659ea320850a00527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0104001600000000000002f4";

        governance::execute_governance_instruction(vaa_bytes);
        assert!(state::get_last_executed_governance_sequence() == 1, 1);

        assert!(state::get_stale_price_threshold_secs() == 756, 1);
    }

    #[test]
    fun test_execute_governance_instruction_set_data_sources() {
        setup_test(100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address 0xf06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf
        // - Sequence number 1
        // - A payload representing a governance instruction with:
        //   - Module number 1
        //   - Target chain 22
        //   - SetDataSources {
        //         sources: [
        //             (23, 0x93a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d),
        //             (12, 0x9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b0),
        //             (18, 0xf7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35)
        //         ]
        //     }
        let vaa_bytes = x"01000000000100d6c0b6dad041866337af989010c88e4230c77ea16aea579a6422aa44a4f0f57e5d0948e40606445bc0753554ffa0c2f9d5c45abf3d3b16a0158957f01cddb6d600527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0102001603001793a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d000c9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b00012f7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35";

        // Set an initial data source
        let initial_data_source = data_source::new(11, external_address::from_bytes(x"4eeb85a8ee41cccd0becb6428cb8f12fd0790b3ad9e378f4dfd81014bc42db1d"));
        state::set_data_sources(vector<DataSource>[initial_data_source]);

        // Execute the VAA
        governance::execute_governance_instruction(vaa_bytes);
        assert!(state::get_last_executed_governance_sequence() == 1, 1);

        // Check that the data sources have been set correctly
        let expected = vector<DataSource>[
            data_source::new(23, external_address::from_bytes(x"93a28e2e5b4cb88f69e96fb29a8287a88b23f0e99f5502f81744e904da8e3b4d")),
            data_source::new(12, external_address::from_bytes(x"9a4066ce1fa26da1c102a3e268abd3ca58e3b3c25f250e6ad9a3525066fbf8b0")),
            data_source::new(18, external_address::from_bytes(x"f7778ca023d5cbe37449bab2faa2a133fe02b056c2c25605950320df08750f35")),
        ];
        assert!(!state::is_valid_data_source(initial_data_source), 1);
        while(vector::is_empty(&expected)) {
            assert!(state::is_valid_data_source(vector::pop_back(&mut expected)), 1);
        }
    }
}

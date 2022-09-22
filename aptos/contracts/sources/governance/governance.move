module pyth::governance {
    use wormhole::vaa::{Self, VAA};
    use pyth::data_source;
    use wormhole::u16;
    use pyth::governance_instruction;
    use pyth::pyth;
    use pyth::governance_action;
    use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::error;
    use pyth::set_update_fee;
    use pyth::state;
    use std::account;

    public entry fun execute_governance_instruction(vaa_bytes: vector<u8>) {
        let parsed_vaa = parse_and_verify_governance_vaa(vaa_bytes);
        let instruction = governance_instruction::from_byte_vec(vaa::destroy(parsed_vaa));

        // Dispatch the instruction to the appropiate handler
        let action = governance_instruction::get_action(&instruction);
        if (action == governance_action::destroy(governance_action::new_contract_upgrade())) {
            contract_upgrade::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_governance_data_source())) {
            set_governance_data_source::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_data_sources())) {
            set_data_sources::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_update_fee())) {
            set_update_fee::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_stale_price_threshold())) {
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

    #[test_only]
    fun setup_test(
        chain_id: u64,
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
        pyth::init_test(signer_capability, chain_id, stale_price_threshold, governance_emitter_chain_id, governance_emitter_address, update_fee);
    }

    #[test]
    #[expected_failure(abort_code = 6)]
    fun execute_governance_instruction_invalid_vaa() {
        setup_test(20, 50, 24, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);
        let vaa_bytes = x"6c436741b108";
        execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65550)]
    fun execute_governance_instruction_invalid_data_source() {
        setup_test(20, 100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID of 20
        // - Emitter address of x"ed67fcc21620d1bf9f69db61ea65ea36ae2df4f86c8e1b9503f0da287c24ed41"
        let vaa_bytes = x"0100000000010066359039306c20c8e6d0047ca82aef1b3d1059a3196ab9b21ee9eb8d8438c4e06c3f181d86687cf52f8c4a167ce8af6a5dbadad22253a4016dc28a25f181a37301527e4f9b000000010014ed67fcc21620d1bf9f69db61ea65ea36ae2df4f86c8e1b9503f0da287c24ed410000000000000000005054474eb01087a85361f738f19454e66664d3c9";
        execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65551)]
    fun execute_governance_instruction_invalid_sequence_number_0() {
        setup_test(20, 100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf"
        // - Sequence number 0
        let vaa_bytes = x"010000000001004d7facf7151ada96a35a3f099843c5f13bd0e0a6cbf50722d4e456d370bbce8641ecc16450979d4c403888f9f08d5975503d810732dc95575880d2a4c64d40aa01527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000000005054474eb01087a85361f738f19454e66664d3c9";
        execute_governance_instruction(vaa_bytes);
    }

    #[test]
    #[expected_failure(abort_code = 65556)]
    fun execute_governance_instruction_invalid_instruction_magic() {
        setup_test(20, 100, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", 100);

        // A VAA with:
        // - Emitter chain ID 50
        // - Emitter address x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf"
        // - Sequence number 1
        // - A payload with the value x"5054474eb01087a85361f738f19454e66664d3c9", so the magic number will be 5054474e
        let vaa_bytes = x"01000000000100583334c65aff30780bf7f2ac783398a2a985e3e4873264e46c3cddfdfb2eaa484365e9f4a3ecc14d059ac1cf0a7b6a58075749ad17a3bfd4153d8f45b9084a3500527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474eb01087a85361f738f19454e66664d3c9";
        execute_governance_instruction(vaa_bytes);
    }

}

use snforge_std::{
    declare, ContractClass, ContractClassTrait, start_prank, stop_prank, CheatTarget, Event,
    event_name_hash, spy_events, SpyOn, EventFetcher,
};
use pyth::wormhole::{
    IWormholeDispatcher, IWormholeDispatcherTrait, ParseAndVerifyVmError, Event as WormholeEvent,
    GuardianSetAdded
};
use pyth::reader::ReaderImpl;
use pyth::byte_array::{ByteArray, ByteArrayImpl};
use pyth::util::{UnwrapWithFelt252, array_try_into};
use core::starknet::{ContractAddress, EthAddress};
use core::panic_with_felt252;
use super::data;
use super::wormhole_guardians::{
    guardian_set0, guardian_set1, guardian_set2, guardian_set3, guardian_set4
};

#[generate_trait]
impl DecodeEventHelpers of DecodeEventHelpersTrait {
    fn pop<T, +TryInto<felt252, T>>(ref self: Array<felt252>) -> T {
        self.pop_front().unwrap().try_into().unwrap()
    }
}

fn decode_event(mut event: Event) -> WormholeEvent {
    let key0: felt252 = event.keys.pop();
    let output = if key0 == event_name_hash('GuardianSetAdded') {
        let event = GuardianSetAdded { index: event.data.pop(), };
        WormholeEvent::GuardianSetAdded(event)
    } else {
        panic!("unrecognized event")
    };
    assert!(event.keys.len() == 0);
    assert!(event.data.len() == 0);
    output
}

#[test]
fn test_parse_and_verify_vm_works() {
    let dispatcher = deploy_with_mainnet_guardians();
    assert!(dispatcher.chain_id() == CHAIN_ID);
    assert!(dispatcher.governance_chain_id() == GOVERNANCE_CHAIN_ID);
    assert!(dispatcher.governance_contract() == GOVERNANCE_CONTRACT);
    assert!(dispatcher.get_current_guardian_set_index() == 4);
    let hash1 = 107301215816534416941414788869570552056251358022232518071775510605007996627157;
    assert!(dispatcher.governance_action_is_consumed(hash1));
    let hash2 = 69383087152252644362837994811527963218617951938616206795754532940371100771846;
    assert!(dispatcher.governance_action_is_consumed(hash2));
    let hash3 = 98574986520203705693876007869045870422906099682167905265431258750902697716275;
    assert!(dispatcher.governance_action_is_consumed(hash3));
    let hash4 = 108039149047034949008762260417639972218494870245424949643402483285149262098173;
    assert!(dispatcher.governance_action_is_consumed(hash4));
    let not_hash4 = 108039149047034949008762260417639972218494870245424949643402483285149262098174;
    assert!(!dispatcher.governance_action_is_consumed(not_hash4));

    let vm = dispatcher.parse_and_verify_vm(data::good_vm1());
    assert!(vm.version == 1);
    assert!(vm.guardian_set_index == 3);
    assert!(vm.signatures.len() == 13);
    assert!(*vm.signatures.at(0).guardian_index == 1);
    assert!(*vm.signatures.at(1).guardian_index == 2);
    assert!(*vm.signatures.at(12).guardian_index == 18);
    assert!(vm.timestamp == 1712589207);
    assert!(vm.nonce == 0);
    assert!(vm.emitter_chain_id == 26);
    assert!(
        vm.emitter_address == 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71
    );
    assert!(vm.sequence == 0x2f03161);
    assert!(vm.consistency_level == 1);
    assert!(vm.payload.len() == 37);

    let mut reader = ReaderImpl::new(vm.payload);
    assert!(reader.read_u8() == 65);
    assert!(reader.read_u8() == 85);
    assert!(reader.read_u8() == 87);
}

#[test]
#[fuzzer(runs: 100, seed: 0)]
#[should_panic]
fn test_parse_and_verify_vm_rejects_corrupted_vm(pos: usize, random1: usize, random2: usize) {
    let dispatcher = deploy_with_mainnet_guardians();

    let input = corrupted_vm(data::good_vm1(), pos, random1, random2);
    let vm = dispatcher.parse_and_verify_vm(input);
    println!("no error, output: {:?}", vm);
}

#[test]
#[should_panic(expected: ('wrong governance contract',))]
fn test_submit_guardian_set_rejects_invalid_emitter() {
    let dispatcher = deploy_with_test_guardian();

    dispatcher.submit_new_guardian_set(data::wrong_emitter_upgrade());
}

#[test]
#[should_panic(expected: ('invalid guardian set index',))]
fn test_submit_guardian_set_rejects_wrong_index_in_signer() {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade3());
}

#[test]
fn test_submit_guardian_set_emits_events() {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    let mut spy = spy_events(SpyOn::One(dispatcher.contract_address));

    assert!(dispatcher.get_current_guardian_set_index() == 0);
    let hash1 = 107301215816534416941414788869570552056251358022232518071775510605007996627157;
    assert!(!dispatcher.governance_action_is_consumed(hash1));
    let hash2 = 69383087152252644362837994811527963218617951938616206795754532940371100771846;
    assert!(!dispatcher.governance_action_is_consumed(hash2));
    let hash3 = 98574986520203705693876007869045870422906099682167905265431258750902697716275;
    assert!(!dispatcher.governance_action_is_consumed(hash3));

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());

    spy.fetch_events();
    assert!(spy.events.len() == 1);
    let (from, event) = spy.events.pop_front().unwrap();
    assert!(from == dispatcher.contract_address);
    let event = decode_event(event);
    let expected = GuardianSetAdded { index: 1 };
    assert!(event == WormholeEvent::GuardianSetAdded(expected));

    assert!(dispatcher.get_current_guardian_set_index() == 1);
    assert!(dispatcher.governance_action_is_consumed(hash1));
    assert!(!dispatcher.governance_action_is_consumed(hash2));
    assert!(!dispatcher.governance_action_is_consumed(hash3));

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade2());

    spy.fetch_events();
    assert!(spy.events.len() == 1);
    let (from, event) = spy.events.pop_front().unwrap();
    assert!(from == dispatcher.contract_address);
    let event = decode_event(event);
    let expected = GuardianSetAdded { index: 2 };
    assert!(event == WormholeEvent::GuardianSetAdded(expected));

    assert!(dispatcher.get_current_guardian_set_index() == 2);
    assert!(dispatcher.governance_action_is_consumed(hash1));
    assert!(dispatcher.governance_action_is_consumed(hash2));
    assert!(!dispatcher.governance_action_is_consumed(hash3));
}

#[test]
fn test_get_guardian_set_works() {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    let set0 = dispatcher.get_guardian_set(0);
    assert!(set0.keys == guardian_set0());
    assert!(set0.expiration_time.is_none());
    assert!(dispatcher.get_current_guardian_set_index() == 0);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());
    let set0 = dispatcher.get_guardian_set(0);
    assert!(set0.keys == guardian_set0());
    assert!(set0.expiration_time.is_some());
    let set1 = dispatcher.get_guardian_set(1);
    assert!(set1.keys == guardian_set1());
    assert!(set1.expiration_time.is_none());
    assert!(dispatcher.get_current_guardian_set_index() == 1);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade2());
    let set0 = dispatcher.get_guardian_set(0);
    assert!(set0.keys == guardian_set0());
    assert!(set0.expiration_time.is_some());
    let set1 = dispatcher.get_guardian_set(1);
    assert!(set1.keys == guardian_set1());
    assert!(set1.expiration_time.is_some());
    let set2 = dispatcher.get_guardian_set(2);
    assert!(set2.keys == guardian_set2());
    assert!(set2.expiration_time.is_none());
    assert!(dispatcher.get_current_guardian_set_index() == 2);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade3());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade4());
    let set3 = dispatcher.get_guardian_set(3);
    assert!(set3.keys == guardian_set3());
    assert!(set3.expiration_time.is_some());
    let set4 = dispatcher.get_guardian_set(4);
    assert!(set4.keys == guardian_set4());
    assert!(set4.expiration_time.is_none());
    assert!(dispatcher.get_current_guardian_set_index() == 4);
}

#[test]
#[should_panic(expected: ('invalid index',))]
fn test_get_guardian_set_rejects_invalid_index() {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());
    dispatcher.get_guardian_set(2);
}

#[test]
#[should_panic(expected: ('invalid guardian set sequence',))]
fn test_submit_guardian_set_rejects_wrong_index_in_payload() {
    let dispatcher = deploy_with_test_guardian();

    dispatcher.submit_new_guardian_set(data::wrong_index_upgrade());
}

#[test]
#[should_panic(expected: ('no guardians specified',))]
fn test_deploy_rejects_empty() {
    deploy(array![], CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);
}

#[test]
#[should_panic(expected: ('no guardians specified',))]
fn test_submit_guardian_set_rejects_empty() {
    let dispatcher = deploy_with_test_guardian();

    dispatcher.submit_new_guardian_set(data::empty_set_upgrade());
}

#[test]
#[fuzzer(runs: 100, seed: 0)]
#[should_panic]
fn test_submit_guardian_set_rejects_corrupted(pos: usize, random1: usize, random2: usize) {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    let vm = corrupted_vm(data::mainnet_guardian_set_upgrade1(), pos, random1, random2);
    dispatcher.submit_new_guardian_set(vm);
}

#[test]
#[should_panic(expected: ('wrong governance chain',))]
fn test_submit_guardian_set_rejects_non_governance(pos: usize, random1: usize, random2: usize) {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade2());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade3());

    dispatcher.submit_new_guardian_set(data::good_vm1());
}

// Deploys a previously declared wormhole contract class at the specified address.
// If address is not specified, the default address derivation is used.
pub fn deploy_declared_at(
    class: @ContractClass,
    guardians: Array<EthAddress>,
    chain_id: u16,
    governance_chain_id: u16,
    governance_contract: u256,
    address: Option<ContractAddress>,
) -> IWormholeDispatcher {
    let mut args = array![];
    (guardians, chain_id, governance_chain_id, governance_contract).serialize(ref args);
    let result = match address {
        Option::Some(address) => class.deploy_at(@args, address),
        Option::None => class.deploy(@args),
    };
    let contract_address = match result {
        Result::Ok(v) => { v },
        Result::Err(err) => { panic(err.panic_data) },
    };
    IWormholeDispatcher { contract_address }
}

// Declares and deploys the contract.
fn deploy(
    guardians: Array<EthAddress>,
    chain_id: u16,
    governance_chain_id: u16,
    governance_contract: u256,
) -> IWormholeDispatcher {
    let class = declare("wormhole");
    deploy_declared_at(
        @class, guardians, chain_id, governance_chain_id, governance_contract, Option::None
    )
}

// Declares and deploys the contract and initializes it with mainnet guardian set upgrades.
pub fn deploy_with_mainnet_guardians() -> IWormholeDispatcher {
    let dispatcher = deploy(guardian_set0(), CHAIN_ID, GOVERNANCE_CHAIN_ID, GOVERNANCE_CONTRACT);

    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade1());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade2());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade3());
    dispatcher.submit_new_guardian_set(data::mainnet_guardian_set_upgrade4());

    dispatcher
}

// Declares and deploys the contract with the test guardian address that's used to sign VAAs generated in `test_vaas`.
pub fn deploy_with_test_guardian() -> IWormholeDispatcher {
    deploy(
        array_try_into(array![data::TEST_GUARDIAN_ADDRESS1]),
        CHAIN_ID,
        GOVERNANCE_CHAIN_ID,
        GOVERNANCE_CONTRACT,
    )
}

// Deploys a previously declared wormhole contract class
// with the test guardian address that's used to sign VAAs generated in `test_vaas`.
pub fn deploy_declared_with_test_guardian_at(
    class: @ContractClass, address: ContractAddress
) -> IWormholeDispatcher {
    deploy_declared_at(
        class,
        array_try_into(array![data::TEST_GUARDIAN_ADDRESS1]),
        CHAIN_ID,
        GOVERNANCE_CHAIN_ID,
        GOVERNANCE_CONTRACT,
        Option::Some(address),
    )
}

pub fn corrupted_vm(
    mut real_data: ByteArray, pos: usize, random1: usize, random2: usize
) -> ByteArray {
    let mut new_data = array![];

    // Make sure we select a position not on the last item because
    // we didn't implement corrupting an incomplete bytes31.
    let pos = pos % (real_data.len() - 31);
    let bad_index = pos / 31;

    let mut num_last_bytes = 0;
    let mut i = 0;
    loop {
        let (real_bytes, num_bytes) = match real_data.pop_front() {
            Option::Some(v) => v,
            Option::None => { break; }
        };
        if num_bytes < 31 {
            new_data.append(real_bytes);
            num_last_bytes = num_bytes;
            break;
        }

        if i == bad_index {
            new_data.append(corrupted_bytes(real_bytes, pos % 31, random1, random2));
        } else {
            new_data.append(real_bytes);
        }
        i += 1;
    };
    ByteArrayImpl::new(new_data, num_last_bytes)
}

// Returns a `bytes31` value with 2 bytes changed. We need to change at least 2 bytes
// because a single byte can be a recovery id, where only 1 bit matters so
// a modification of recovery id can result in a valid VM.
fn corrupted_bytes(input: bytes31, index: usize, random1: usize, random2: usize) -> bytes31 {
    let index2 = (index + 1) % 31;

    let mut value: u256 = 0;
    let mut i = 0;
    while i < 31 {
        let real_byte = input.at(30 - i);
        let new_byte = if i == index {
            corrupted_byte(real_byte, random1)
        } else if i == index2 {
            corrupted_byte(real_byte, random2)
        } else {
            real_byte
        };
        value = value * 256 + new_byte.into();
        i += 1;
    };
    let value: felt252 = value.try_into().expect('corrupted bytes overflow');
    value.try_into().expect('corrupted bytes overflow')
}

// Returns a byte that's not equal to `value`.
fn corrupted_byte(value: u8, random: usize) -> u8 {
    let v: u16 = value.into() + 1 + (random % 255).try_into().unwrap();
    (v % 256).try_into().unwrap()
}

pub const CHAIN_ID: u16 = 60051;
pub const GOVERNANCE_CHAIN_ID: u16 = 1;
pub const GOVERNANCE_CONTRACT: u256 = 4;

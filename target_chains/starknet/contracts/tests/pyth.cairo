use snforge_std::{
    declare, ContractClassTrait, start_prank, stop_prank, CheatTarget, spy_events, SpyOn, EventSpy,
    EventFetcher, event_name_hash, Event
};
use pyth::pyth::{
    IPythDispatcher, IPythDispatcherTrait, DataSource, Event as PythEvent, PriceFeedUpdateEvent,
    WormholeAddressSet,
};
use pyth::byte_array::{ByteArray, ByteArrayImpl};
use pyth::util::{array_try_into, UnwrapWithFelt252};
use pyth::wormhole::IWormholeDispatcherTrait;
use core::starknet::ContractAddress;
use openzeppelin::token::erc20::interface::{IERC20CamelDispatcher, IERC20CamelDispatcherTrait};
use super::wormhole::corrupted_vm;
use super::data;

fn decode_event(event: @Event) -> PythEvent {
    let key0 = *event.keys.at(0);
    if key0 == event_name_hash('PriceFeedUpdate') {
        assert!(event.keys.len() == 3);
        assert!(event.data.len() == 3);
        let event = PriceFeedUpdateEvent {
            price_id: u256 {
                low: (*event.keys.at(1)).try_into().unwrap(),
                high: (*event.keys.at(2)).try_into().unwrap(),
            },
            publish_time: (*event.data.at(0)).try_into().unwrap(),
            price: (*event.data.at(1)).try_into().unwrap(),
            conf: (*event.data.at(2)).try_into().unwrap(),
        };
        PythEvent::PriceFeedUpdate(event)
    } else if key0 == event_name_hash('WormholeAddressSet') {
        assert!(event.keys.len() == 1);
        assert!(event.data.len() == 2);
        let event = WormholeAddressSet {
            old_address: (*event.data.at(0)).try_into().unwrap(),
            new_address: (*event.data.at(1)).try_into().unwrap(),
        };
        PythEvent::WormholeAddressSet(event)
    } else {
        panic!("unrecognized event")
    }
}

#[test]
fn update_price_feeds_works() {
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let wormhole = super::wormhole::deploy_with_mainnet_guardians();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user.try_into().unwrap());
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    let mut spy = spy_events(SpyOn::One(pyth.contract_address));

    start_prank(CheatTarget::One(pyth.contract_address), user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));

    spy.fetch_events();
    assert!(spy.events.len() == 1);
    let (from, event) = spy.events.at(0);
    assert!(from == @pyth.contract_address);
    let event = decode_event(event);
    let expected = PriceFeedUpdateEvent {
        price_id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
        publish_time: 1712589206,
        price: 7192002930010,
        conf: 3596501465,
    };
    assert!(event == PythEvent::PriceFeedUpdate(expected));

    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 7192002930010);
    assert!(last_price.conf == 3596501465);
    assert!(last_price.expo == -8);
    assert!(last_price.publish_time == 1712589206);

    let last_ema_price = pyth
        .get_ema_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_ema_price.price == 7181868900000);
    assert!(last_ema_price.conf == 4096812700);
    assert!(last_ema_price.expo == -8);
    assert!(last_ema_price.publish_time == 1712589206);
}

#[test]
fn test_governance_set_fee_works() {
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let wormhole = super::wormhole::deploy_with_test_guardian();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    let mut balance = fee_contract.balanceOf(user);
    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 1000);
    balance = new_balance;
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(data::pyth_set_fee());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update2());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 4200);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[fuzzer(runs: 100, seed: 0)]
#[should_panic]
fn test_rejects_corrupted_governance_instruction(pos: usize, random1: usize, random2: usize) {
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let wormhole = super::wormhole::deploy_with_test_guardian();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    let input = corrupted_vm(data::pyth_set_fee(), pos, random1, random2);
    pyth.execute_governance_instruction(input);
}

#[test]
fn test_governance_set_data_sources_works() {
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let wormhole = super::wormhole::deploy_with_test_guardian();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(data::pyth_set_data_sources());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_update2_alt_emitter());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[should_panic(expected: ('invalid update data source',))]
fn test_rejects_update_after_data_source_changed() {
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let wormhole = super::wormhole::deploy_with_test_guardian();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(data::pyth_set_data_sources());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update2());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
fn test_governance_set_wormhole_works() {
    let wormhole_class = declare("wormhole");
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        @wormhole_class, wormhole_address
    );

    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    // Address used in the governance instruction
    let wormhole2_address = 0x05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2
        .try_into()
        .unwrap();
    let wormhole2 = super::wormhole::deploy_declared_with_test_guardian_at(
        @wormhole_class, wormhole2_address
    );
    wormhole2.submit_new_guardian_set(data::upgrade_to_test2());

    let mut spy = spy_events(SpyOn::One(pyth.contract_address));

    pyth.execute_governance_instruction(data::pyth_set_wormhole());

    spy.fetch_events();
    assert!(spy.events.len() == 1);
    let (from, event) = spy.events.at(0);
    assert!(from == @pyth.contract_address);
    let event = decode_event(event);
    let expected = WormholeAddressSet {
        old_address: wormhole_address, new_address: wormhole2_address,
    };
    assert!(event == PythEvent::WormholeAddressSet(expected));

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_update2_set2());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[should_panic(expected: ('invalid guardian set index',))]
fn test_rejects_price_update_without_setting_wormhole() {
    let wormhole = super::wormhole::deploy_with_test_guardian();
    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    start_prank(CheatTarget::One(fee_contract.contract_address), user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_prank(CheatTarget::One(fee_contract.contract_address));

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(data::test_update2_set2());
}

// This test doesn't pass because of an snforge bug.
// See https://github.com/foundry-rs/starknet-foundry/issues/2096
// TODO: update snforge and unignore when the next release is available
#[test]
#[should_panic]
#[ignore]
fn test_rejects_set_wormhole_without_deploying() {
    let wormhole_class = declare("wormhole");
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        @wormhole_class, wormhole_address
    );

    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);
    pyth.execute_governance_instruction(data::pyth_set_wormhole());
}

#[test]
#[should_panic(expected: ('Invalid signature',))]
fn test_rejects_set_wormhole_with_incompatible_guardians() {
    let wormhole_class = declare("wormhole");
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        @wormhole_class, wormhole_address
    );

    let owner = 'owner'.try_into().unwrap();
    let user = 'user'.try_into().unwrap();
    let fee_contract = deploy_fee_contract(user);
    let pyth = deploy_default(owner, wormhole.contract_address, fee_contract.contract_address);

    // Address used in the governance instruction
    let wormhole2_address = 0x05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2
        .try_into()
        .unwrap();
    super::wormhole::deploy_declared_at(
        @wormhole_class,
        array_try_into(array![0x301]),
        super::wormhole::CHAIN_ID,
        super::wormhole::GOVERNANCE_CHAIN_ID,
        super::wormhole::GOVERNANCE_CONTRACT,
        Option::Some(wormhole2_address),
    );
    pyth.execute_governance_instruction(data::pyth_set_wormhole());
}

fn deploy_default(
    owner: ContractAddress, wormhole_address: ContractAddress, fee_contract_address: ContractAddress
) -> IPythDispatcher {
    deploy(
        owner,
        wormhole_address,
        fee_contract_address,
        1000,
        array![
            DataSource {
                emitter_chain_id: 26,
                emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
            }
        ],
        1,
        41,
        0,
    )
}

fn deploy(
    owner: ContractAddress,
    wormhole_address: ContractAddress,
    fee_contract_address: ContractAddress,
    single_update_fee: u256,
    data_sources: Array<DataSource>,
    governance_emitter_chain_id: u16,
    governance_emitter_address: u256,
    governance_initial_sequence: u64,
) -> IPythDispatcher {
    let mut args = array![];
    (owner, wormhole_address, fee_contract_address, single_update_fee).serialize(ref args);
    (data_sources, governance_emitter_chain_id).serialize(ref args);
    (governance_emitter_address, governance_initial_sequence).serialize(ref args);
    let contract = declare("pyth");
    let contract_address = match contract.deploy(@args) {
        Result::Ok(v) => { v },
        Result::Err(err) => {
            panic(err.panic_data);
            0.try_into().unwrap()
        },
    };
    IPythDispatcher { contract_address }
}

fn deploy_fee_contract(recipient: ContractAddress) -> IERC20CamelDispatcher {
    let mut args = array![];
    let name: core::byte_array::ByteArray = "eth";
    let symbol: core::byte_array::ByteArray = "eth";
    (name, symbol, 100000_u256, recipient).serialize(ref args);
    let contract = declare("ERC20");
    let contract_address = match contract.deploy(@args) {
        Result::Ok(v) => { v },
        Result::Err(err) => {
            panic(err.panic_data);
            0.try_into().unwrap()
        },
    };
    IERC20CamelDispatcher { contract_address }
}

use openzeppelin::token::erc20::interface::{IERC20CamelDispatcher, IERC20CamelDispatcherTrait};
use pyth::byte_buffer::ByteBufferImpl;
use pyth::pyth::{
    ContractUpgraded, DataSource, DataSourcesSet, Event as PythEvent, FeeSet,
    GetPriceNoOlderThanError, GetPriceUnsafeError, GovernanceDataSourceSet, IPythDispatcher,
    IPythDispatcherTrait, Price, PriceFeed, PriceFeedPublishTime, PriceFeedUpdated,
    WormholeAddressSet,
};
use pyth::util::{UnwrapWithFelt252, array_try_into};
use pyth::wormhole::{IWormholeDispatcher, IWormholeDispatcherTrait};
use snforge_std::{
    ContractClass, ContractClassTrait, DeclareResultTrait, Event, EventSpyTrait, EventsFilterTrait,
    declare, spy_events, start_cheat_block_timestamp, start_cheat_caller_address,
    stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::wormhole::corrupted_vm;
use super::data;

#[generate_trait]
impl DecodeEventHelpers of DecodeEventHelpersTrait {
    fn pop<T, +TryInto<felt252, T>>(ref self: Array<felt252>) -> T {
        self.pop_front().unwrap().try_into().unwrap()
    }

    fn pop_u256(ref self: Array<felt252>) -> u256 {
        u256 { low: self.pop(), high: self.pop() }
    }

    fn pop_data_source(ref self: Array<felt252>) -> DataSource {
        DataSource { emitter_chain_id: self.pop(), emitter_address: self.pop_u256() }
    }

    fn pop_data_sources(ref self: Array<felt252>) -> Array<DataSource> {
        let count: usize = self.pop();
        let mut i = 0;
        let mut output = array![];
        while i < count {
            output.append(self.pop_data_source());
            i += 1;
        }
        output
    }
}

fn decode_event(mut event: Event) -> PythEvent {
    let key0: felt252 = event.keys.pop();
    let output = if key0 == selector!("PriceFeedUpdated") {
        let event = PriceFeedUpdated {
            price_id: event.keys.pop_u256(),
            price: event.data.pop(),
            conf: event.data.pop(),
            publish_time: event.data.pop(),
        };
        PythEvent::PriceFeedUpdated(event)
    } else if key0 == selector!("FeeSet") {
        let event = FeeSet {
            old_fee: event.data.pop_u256(), new_fee: event.data.pop_u256(), token: event.data.pop(),
        };
        PythEvent::FeeSet(event)
    } else if key0 == selector!("DataSourcesSet") {
        let event = DataSourcesSet {
            old_data_sources: event.data.pop_data_sources(),
            new_data_sources: event.data.pop_data_sources(),
        };
        PythEvent::DataSourcesSet(event)
    } else if key0 == selector!("WormholeAddressSet") {
        let event = WormholeAddressSet {
            old_address: event.data.pop(), new_address: event.data.pop(),
        };
        PythEvent::WormholeAddressSet(event)
    } else if key0 == selector!("GovernanceDataSourceSet") {
        let event = GovernanceDataSourceSet {
            old_data_source: event.data.pop_data_source(),
            new_data_source: event.data.pop_data_source(),
            last_executed_governance_sequence: event.data.pop(),
        };
        PythEvent::GovernanceDataSourceSet(event)
    } else if key0 == selector!("ContractUpgraded") {
        let event = ContractUpgraded { new_class_hash: event.data.pop() };
        PythEvent::ContractUpgraded(event)
    } else {
        panic!("unrecognized event")
    };
    assert!(event.keys.len() == 0);
    assert!(event.data.len() == 0);
    output
}

#[test]
fn test_getters_work() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    assert!(pyth.wormhole_address() == ctx.wormhole.contract_address);
    assert!(
        pyth
            .fee_token_addresses() == array![
                ctx.fee_contract.contract_address, ctx.fee_contract2.contract_address,
            ],
    );
    assert!(pyth.get_single_update_fee(ctx.fee_contract.contract_address) == 1000);
    assert!(pyth.get_single_update_fee(ctx.fee_contract2.contract_address) == 2000);
    assert!(
        pyth
            .valid_data_sources() == array![
                DataSource {
                    emitter_chain_id: 26,
                    emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
                },
            ],
    );
    assert!(
        pyth
            .is_valid_data_source(
                DataSource {
                    emitter_chain_id: 26,
                    emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
                },
            ),
    );
    assert!(
        !pyth.is_valid_data_source(DataSource { emitter_chain_id: 26, emitter_address: 0xbad }),
    );
    assert!(
        !pyth
            .is_valid_data_source(
                DataSource {
                    emitter_chain_id: 27,
                    emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
                },
            ),
    );
    assert!(
        pyth.governance_data_source() == DataSource { emitter_chain_id: 1, emitter_address: 41 },
    );
    assert!(
        pyth
            .is_valid_governance_data_source(
                DataSource { emitter_chain_id: 1, emitter_address: 41 },
            ),
    );
    assert!(
        !pyth
            .is_valid_governance_data_source(
                DataSource { emitter_chain_id: 1, emitter_address: 42 },
            ),
    );
    assert!(pyth.last_executed_governance_sequence() == 0);
    assert!(pyth.governance_data_source_index() == 0);
    assert!(pyth.chain_id() == 60051);
}

#[test]
fn update_price_feeds_works() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    assert!(
        !pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 0,
    );

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    ctx.approve_fee(fee);

    let mut spy = spy_events();

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);

    let mut events = spy.get_events().emitted_by(pyth.contract_address).events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = PriceFeedUpdated {
        price_id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
        publish_time: 1712589206,
        price: 7192002930010,
        conf: 3596501465,
    };
    assert!(event == PythEvent::PriceFeedUpdated(expected));

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

    let feed = pyth
        .query_price_feed_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(feed.id == 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43);
    assert!(feed.price.price == 7192002930010);
    assert!(feed.price.conf == 3596501465);
    assert!(feed.price.expo == -8);
    assert!(feed.price.publish_time == 1712589206);
    assert!(feed.ema_price.price == 7181868900000);
    assert!(feed.ema_price.conf == 4096812700);
    assert!(feed.ema_price.expo == -8);
    assert!(feed.ema_price.publish_time == 1712589206);

    assert!(
        pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 1712589206,
    );
}

#[test]
fn update_price_feeds_works2() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;
    let fee = pyth.get_update_fee(data::good_update2(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    ctx.approve_fee(fee);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update2());
    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
fn test_accepts_secondary_fee() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    assert!(
        !pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 0,
    );

    let fee2 = pyth.get_update_fee(data::good_update1(), ctx.fee_contract2.contract_address);
    assert!(fee2 == 2000);
    ctx.approve_fee2(fee2);

    let balance1 = ctx.fee_contract.balanceOf(ctx.user);
    let balance2 = ctx.fee_contract2.balanceOf(ctx.user);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);
    assert!(balance1 - ctx.fee_contract.balanceOf(ctx.user) == 0);
    assert!(balance2 - ctx.fee_contract2.balanceOf(ctx.user) == 2000);
}

#[test]
fn test_accepts_secondary_fee_if_first_allowance_insufficient() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    assert!(
        !pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 0,
    );

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    let fee2 = pyth.get_update_fee(data::good_update1(), ctx.fee_contract2.contract_address);
    assert!(fee2 == 2000);
    ctx.approve_fee(500);
    ctx.approve_fee2(fee2);

    let balance1 = ctx.fee_contract.balanceOf(ctx.user);
    let balance2 = ctx.fee_contract2.balanceOf(ctx.user);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);
    assert!(balance1 - ctx.fee_contract.balanceOf(ctx.user) == 0);
    assert!(balance2 - ctx.fee_contract2.balanceOf(ctx.user) == 2000);
}

#[test]
fn test_accepts_secondary_fee_if_first_balance_insufficient() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;
    let user2 = 'user2'.try_into().unwrap();

    start_cheat_caller_address(ctx.fee_contract.contract_address, ctx.user);
    ctx.fee_contract.transfer(user2, 500);
    stop_cheat_caller_address(ctx.fee_contract.contract_address);

    start_cheat_caller_address(ctx.fee_contract2.contract_address, ctx.user);
    ctx.fee_contract2.transfer(user2, 2000);
    stop_cheat_caller_address(ctx.fee_contract2.contract_address);

    assert!(
        !pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 0,
    );

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    let fee2 = pyth.get_update_fee(data::good_update1(), ctx.fee_contract2.contract_address);
    assert!(fee2 == 2000);
    start_cheat_caller_address(ctx.fee_contract.contract_address, user2);
    ctx.fee_contract.approve(ctx.pyth.contract_address, fee);
    stop_cheat_caller_address(ctx.fee_contract.contract_address);

    start_cheat_caller_address(ctx.fee_contract2.contract_address, user2);
    ctx.fee_contract2.approve(ctx.pyth.contract_address, fee2);
    stop_cheat_caller_address(ctx.fee_contract2.contract_address);

    let balance1 = ctx.fee_contract.balanceOf(user2);
    let balance2 = ctx.fee_contract2.balanceOf(user2);
    start_cheat_caller_address(pyth.contract_address, user2.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);
    assert!(balance1 - ctx.fee_contract.balanceOf(user2) == 0);
    assert!(balance2 - ctx.fee_contract2.balanceOf(user2) == 2000);
}

#[test]
#[should_panic(expected: ('insufficient fee allowance',))]
fn test_rejects_if_both_fees_insufficient() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    assert!(
        !pyth.price_feed_exists(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43),
    );
    assert!(
        pyth
            .latest_price_info_publish_time(
                0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
            ) == 0,
    );

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    let fee2 = pyth.get_update_fee(data::good_update1(), ctx.fee_contract2.contract_address);
    assert!(fee2 == 2000);
    ctx.approve_fee(500);
    ctx.approve_fee2(1500);

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
#[should_panic(expected: ('unsupported token',))]
fn test_get_update_fee_rejects_unsupported_token() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    pyth.get_update_fee(data::good_update1(), ctx.pyth.contract_address);
}

#[test]
#[should_panic(expected: ('unsupported token',))]
fn test_get_single_update_fee_rejects_unsupported_token() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    pyth.get_single_update_fee(ctx.pyth.contract_address);
}

#[test]
fn test_update_if_necessary_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    ctx.approve_fee(10000);

    let mut spy = spy_events();

    let price_id = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    assert!(pyth.get_price_unsafe(price_id).is_err());

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    let times = array![PriceFeedPublishTime { price_id, publish_time: 1715769470 }];
    pyth.update_price_feeds_if_necessary(data::test_price_update1(), times);

    let last_price = pyth.get_price_unsafe(price_id).unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);
    assert!(last_price.publish_time == 1715769470);

    let mut events = spy.get_events().emitted_by(pyth.contract_address).events;
    assert!(events.len() == 1);

    let times = array![PriceFeedPublishTime { price_id, publish_time: 1715769475 }];
    pyth.update_price_feeds_if_necessary(data::test_price_update2(), times);

    let last_price = pyth.get_price_unsafe(price_id).unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
    assert!(last_price.publish_time == 1715769475);

    events = spy.get_events().emitted_by(pyth.contract_address).events;
    assert!(events.len() == 2);

    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
fn test_parse_price_feed_updates_works() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    ctx.approve_fee(1000);

    let mut spy = spy_events();

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    let output = pyth
        .parse_price_feed_updates(
            data::good_update1(),
            array![0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43],
            0,
            1712589208,
        );
    stop_cheat_caller_address(pyth.contract_address);
    assert!(output.len() == 1);
    let output = output.at(0).clone();
    let expected = PriceFeed {
        id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
        price: Price { price: 7192002930010, conf: 3596501465, expo: -8, publish_time: 1712589206 },
        ema_price: Price {
            price: 7181868900000, conf: 4096812700, expo: -8, publish_time: 1712589206,
        },
    };
    assert!(output == expected);

    let mut events = spy.get_events().emitted_by(pyth.contract_address).events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = PriceFeedUpdated {
        price_id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
        publish_time: 1712589206,
        price: 7192002930010,
        conf: 3596501465,
    };
    assert!(event == PythEvent::PriceFeedUpdated(expected));

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
#[should_panic(expected: ('price feed not found',))]
fn test_parse_price_feed_updates_rejects_bad_price_id() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    ctx.approve_fee(fee);

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.parse_price_feed_updates(data::good_update1(), array![0x14], 0, 1712589208);
}

#[test]
#[should_panic(expected: ('price feed not found',))]
fn test_parse_price_feed_updates_rejects_out_of_range() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let fee = pyth.get_update_fee(data::good_update1(), ctx.fee_contract.contract_address);
    assert!(fee == 1000);
    ctx.approve_fee(fee);

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth
        .parse_price_feed_updates(
            data::good_update1(),
            array![0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43],
            0,
            1712589000,
        );
}

#[test]
fn test_parse_price_feed_updates_unique_works() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let fee1 = pyth.get_update_fee(data::test_price_update2(), ctx.fee_contract.contract_address);
    assert!(fee1 == 1000);
    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    let output = pyth
        .parse_unique_price_feed_updates(
            data::unique_update1(),
            array![0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43],
            1716904943,
            2,
        );
    stop_cheat_caller_address(pyth.contract_address);
    assert!(output.len() == 1);
    let output = output.at(0).clone();
    let expected = PriceFeed {
        id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
        price: Price { price: 6751021151231, conf: 7471389383, expo: -8, publish_time: 1716904943 },
        ema_price: Price {
            price: 6815630100000, conf: 6236878200, expo: -8, publish_time: 1716904943,
        },
    };
    assert!(output == expected);
}

#[test]
#[should_panic(expected: ('price feed not found',))]
fn test_parse_price_feed_updates_unique_rejects_non_unique() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let fee1 = pyth.get_update_fee(data::test_price_update2(), ctx.fee_contract.contract_address);
    assert!(fee1 == 1000);
    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth
        .parse_unique_price_feed_updates(
            data::good_update1(),
            array![0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43],
            1712589206,
            2,
        );
}

#[test]
#[should_panic(expected: ('no fresh update',))]
fn test_update_if_necessary_rejects_empty() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds_if_necessary(data::test_price_update1(), array![]);
    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
#[should_panic(expected: ('no fresh update',))]
fn test_update_if_necessary_rejects_no_fresh() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    ctx.approve_fee(10000);

    let mut spy = spy_events();

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds_if_necessary(data::test_price_update1(), array![]);

    let price_id = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    assert!(pyth.get_price_unsafe(price_id).is_err());
    let mut events = spy.get_events().events;
    assert!(events.len() == 0);

    let times = array![PriceFeedPublishTime { price_id, publish_time: 1715769470 }];
    pyth.update_price_feeds_if_necessary(data::test_price_update1(), times);

    let last_price = pyth.get_price_unsafe(price_id).unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);
    assert!(last_price.publish_time == 1715769470);

    events = spy.get_events().events;
    assert!(events.len() == 1);

    let times = array![PriceFeedPublishTime { price_id, publish_time: 1715769470 }];
    pyth.update_price_feeds_if_necessary(data::test_price_update2(), times);
}

#[test]
fn test_get_no_older_works() {
    let ctx = deploy_mainnet();
    let pyth = ctx.pyth;

    let price_id = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    let err = pyth.get_price_unsafe(price_id).unwrap_err();
    assert!(err == GetPriceUnsafeError::PriceFeedNotFound);
    let err = pyth.get_ema_price_unsafe(price_id).unwrap_err();
    assert!(err == GetPriceUnsafeError::PriceFeedNotFound);
    let err = pyth.query_price_feed_unsafe(price_id).unwrap_err();
    assert!(err == GetPriceUnsafeError::PriceFeedNotFound);
    let err = pyth.get_price_no_older_than(price_id, 100).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::PriceFeedNotFound);
    let err = pyth.get_ema_price_no_older_than(price_id, 100).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::PriceFeedNotFound);
    let err = pyth.query_price_feed_no_older_than(price_id, 100).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::PriceFeedNotFound);

    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);

    start_cheat_block_timestamp(pyth.contract_address, 1712589210);
    let err = pyth.get_price_no_older_than(price_id, 3).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::StalePrice);
    let err = pyth.get_ema_price_no_older_than(price_id, 3).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::StalePrice);
    let err = pyth.query_price_feed_no_older_than(price_id, 3).unwrap_err();
    assert!(err == GetPriceNoOlderThanError::StalePrice);

    start_cheat_block_timestamp(pyth.contract_address, 1712589208);
    let val = pyth.get_price_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.publish_time == 1712589206);
    assert!(val.price == 7192002930010);
    let val = pyth.get_ema_price_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.publish_time == 1712589206);
    assert!(val.price == 7181868900000);
    let val = pyth.query_price_feed_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.price.publish_time == 1712589206);
    assert!(val.price.price == 7192002930010);

    start_cheat_block_timestamp(pyth.contract_address, 1712589204);
    let val = pyth.get_price_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.publish_time == 1712589206);
    assert!(val.price == 7192002930010);
    let val = pyth.get_ema_price_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.publish_time == 1712589206);
    assert!(val.price == 7181868900000);
    let val = pyth.query_price_feed_no_older_than(price_id, 3).unwrap_with_felt252();
    assert!(val.price.publish_time == 1712589206);
    assert!(val.price.price == 7192002930010);

    stop_cheat_block_timestamp(pyth.contract_address);
}

#[test]
fn test_governance_set_fee_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    let fee_contract = ctx.fee_contract;
    let user = ctx.user;

    let fee1 = pyth.get_update_fee(data::test_price_update1(), ctx.fee_contract.contract_address);
    assert!(fee1 == 1000);
    ctx.approve_fee(10000);

    let mut balance = fee_contract.balanceOf(user);
    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 1000);
    balance = new_balance;
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    let mut spy = spy_events();

    pyth.execute_governance_instruction(data::pyth_set_fee());

    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = FeeSet {
        old_fee: 1000, new_fee: 4200, token: ctx.fee_contract.contract_address,
    };
    assert!(event == PythEvent::FeeSet(expected));

    let fee2 = pyth.get_update_fee(data::test_price_update2(), ctx.fee_contract.contract_address);
    assert!(fee2 == 4200);
    let fee2_alt = pyth
        .get_update_fee(data::test_price_update2(), ctx.fee_contract2.contract_address);
    assert!(fee2_alt == 2000);

    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_price_update2());
    stop_cheat_caller_address(pyth.contract_address);
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 4200);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
fn test_governance_set_fee_in_token_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    let fee_contract = ctx.fee_contract;
    let user = ctx.user;

    let fee1 = pyth.get_update_fee(data::test_price_update1(), ctx.fee_contract.contract_address);
    assert!(fee1 == 1000);
    ctx.approve_fee(1000);

    let mut balance = fee_contract.balanceOf(user);
    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 1000);
    balance = new_balance;
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    let mut spy = spy_events();

    pyth.execute_governance_instruction(data::pyth_set_fee_in_token());

    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = FeeSet {
        old_fee: 2000, new_fee: 4200, token: ctx.fee_contract2.contract_address,
    };
    assert!(event == PythEvent::FeeSet(expected));

    let fee2 = pyth.get_update_fee(data::test_price_update2(), ctx.fee_contract.contract_address);
    assert!(fee2 == 1000);
    let fee2_alt = pyth
        .get_update_fee(data::test_price_update2(), ctx.fee_contract2.contract_address);
    assert!(fee2_alt == 4200);
    ctx.approve_fee2(4200);

    let balance2 = ctx.fee_contract2.balanceOf(user);
    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_price_update2());
    stop_cheat_caller_address(pyth.contract_address);
    let new_balance2 = ctx.fee_contract2.balanceOf(user);
    assert!(balance2 - new_balance2 == 4200);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[fuzzer(runs: 100, seed: 0)]
#[should_panic]
fn test_rejects_corrupted_governance_instruction(pos: usize, random1: usize, random2: usize) {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    let input = corrupted_vm(data::pyth_set_fee(), pos, random1, random2);
    pyth.execute_governance_instruction(input);
}

#[test]
fn test_governance_set_data_sources_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    let mut spy = spy_events();

    pyth.execute_governance_instruction(data::pyth_set_data_sources());

    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = DataSourcesSet {
        old_data_sources: array![
            DataSource {
                emitter_chain_id: 26,
                emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
            },
        ],
        new_data_sources: array![
            DataSource {
                emitter_chain_id: 1,
                emitter_address: 0x6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25,
            },
            DataSource { emitter_chain_id: 3, emitter_address: 0x12d },
        ],
    };
    assert!(event == PythEvent::DataSourcesSet(expected));

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_update2_alt_emitter());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[should_panic(expected: ('invalid update data source',))]
fn test_rejects_update_after_data_source_changed() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;
    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(data::pyth_set_data_sources());

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_price_update2());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
fn test_governance_set_wormhole_works() {
    let wormhole_class = declare("wormhole").unwrap().contract_class();
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        wormhole_class, wormhole_address,
    );

    let user = 'user'.try_into().unwrap();
    let fee_class = declare("ERC20Upgradeable").unwrap().contract_class().deref();
    let fee_contract = deploy_fee_contract(fee_class, fee_address1(), user);
    let fee_contract2 = deploy_fee_contract(fee_class, fee_address2(), user);
    let pyth = deploy_pyth_default(
        wormhole.contract_address, fee_contract.contract_address, fee_contract2.contract_address,
    );

    start_cheat_caller_address(fee_contract.contract_address, user);
    fee_contract.approve(pyth.contract_address, 10000);
    stop_cheat_caller_address(fee_contract.contract_address);

    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    // Address used in the governance instruction
    let wormhole2_address = 0x05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2
        .try_into()
        .unwrap();
    let wormhole2 = super::wormhole::deploy_declared_with_test_guardian_at(
        wormhole_class, wormhole2_address,
    );
    wormhole2.submit_new_guardian_set(data::upgrade_to_test2());

    let mut spy = spy_events();

    pyth.execute_governance_instruction(data::pyth_set_wormhole());

    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = WormholeAddressSet {
        old_address: wormhole_address, new_address: wormhole2_address,
    };
    assert!(event == PythEvent::WormholeAddressSet(expected));

    start_cheat_caller_address(pyth.contract_address, user);
    pyth.update_price_feeds(data::test_update2_set2());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
}

#[test]
#[should_panic(expected: ('invalid guardian set index',))]
fn test_rejects_price_update_without_setting_wormhole() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    ctx.approve_fee(10000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_price_update1());
    stop_cheat_caller_address(pyth.contract_address);
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    start_cheat_caller_address(pyth.contract_address, ctx.user);
    pyth.update_price_feeds(data::test_update2_set2());
}

// This test doesn't pass because of an snforge bug.
// See https://github.com/foundry-rs/starknet-foundry/issues/2096
// TODO: update snforge and unignore when the next release is available
#[test]
#[should_panic]
#[ignore]
fn test_rejects_set_wormhole_without_deploying() {
    let wormhole_class = declare("wormhole").unwrap().contract_class();
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        wormhole_class, wormhole_address,
    );

    let user = 'user'.try_into().unwrap();
    let fee_class = declare("ERC20Upgradeable").unwrap().contract_class().deref();
    let fee_contract = deploy_fee_contract(fee_class, fee_address1(), user);
    let fee_contract2 = deploy_fee_contract(fee_class, fee_address2(), user);
    let pyth = deploy_pyth_default(
        wormhole.contract_address, fee_contract.contract_address, fee_contract2.contract_address,
    );
    pyth.execute_governance_instruction(data::pyth_set_wormhole());
}

#[test]
#[should_panic(expected: ('Invalid signature',))]
fn test_rejects_set_wormhole_with_incompatible_guardians() {
    let wormhole_class = declare("wormhole").unwrap().contract_class();
    // Arbitrary
    let wormhole_address = 0x42.try_into().unwrap();
    let wormhole = super::wormhole::deploy_declared_with_test_guardian_at(
        wormhole_class, wormhole_address,
    );

    let user = 'user'.try_into().unwrap();
    let fee_class = declare("ERC20Upgradeable").unwrap().contract_class().deref();
    let fee_contract = deploy_fee_contract(fee_class, fee_address1(), user);
    let fee_contract2 = deploy_fee_contract(fee_class, fee_address2(), user);
    let pyth = deploy_pyth_default(
        wormhole.contract_address, fee_contract.contract_address, fee_contract2.contract_address,
    );

    // Address used in the governance instruction
    let wormhole2_address = 0x05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2
        .try_into()
        .unwrap();
    super::wormhole::deploy_declared_at(
        wormhole_class,
        0,
        array_try_into(array![0x301]),
        super::wormhole::CHAIN_ID,
        super::wormhole::GOVERNANCE_CHAIN_ID,
        super::wormhole::GOVERNANCE_CONTRACT,
        Option::Some(wormhole2_address),
    );
    pyth.execute_governance_instruction(data::pyth_set_wormhole());
}

#[test]
fn test_governance_transfer_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    let mut spy = spy_events();
    pyth.execute_governance_instruction(data::pyth_auth_transfer());
    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = GovernanceDataSourceSet {
        old_data_source: DataSource { emitter_chain_id: 1, emitter_address: 41 },
        new_data_source: DataSource { emitter_chain_id: 2, emitter_address: 43 },
        last_executed_governance_sequence: 1,
    };
    assert!(event == PythEvent::GovernanceDataSourceSet(expected));

    pyth.execute_governance_instruction(data::pyth_set_fee_alt_emitter());
}

#[test]
#[should_panic(expected: ('invalid governance data source',))]
fn test_set_fee_rejects_wrong_emitter() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    pyth.execute_governance_instruction(data::pyth_set_fee_alt_emitter());
}

#[test]
#[should_panic(expected: ('invalid governance data source',))]
fn test_rejects_old_emitter_after_transfer() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    pyth.execute_governance_instruction(data::pyth_auth_transfer());
    pyth.execute_governance_instruction(data::pyth_set_fee());
}

#[test]
fn test_upgrade_works() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    let class = declare("pyth_fake_upgrade1").unwrap().contract_class();
    let mut spy = spy_events();
    pyth.execute_governance_instruction(data::pyth_upgrade_fake1());
    let mut events = spy.get_events().events;
    assert!(events.len() == 1);
    let (from, event) = events.pop_front().unwrap();
    assert!(from == pyth.contract_address);
    let event = decode_event(event);
    let expected = ContractUpgraded { new_class_hash: class.class_hash.deref() };
    assert!(event == PythEvent::ContractUpgraded(expected));

    let last_price = pyth.get_price_unsafe(1234).unwrap_with_felt252();
    assert!(last_price.price == 42);
}

#[test]
#[should_panic]
#[ignore] // TODO: unignore when snforge is updated
fn test_upgrade_rejects_invalid_hash() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    pyth.execute_governance_instruction(data::pyth_upgrade_invalid_hash());
}

#[test]
#[should_panic]
#[ignore] // TODO: unignore when snforge is updated
fn test_upgrade_rejects_not_pyth() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    declare("pyth_fake_upgrade_not_pyth").unwrap().contract_class();
    pyth.execute_governance_instruction(data::pyth_upgrade_not_pyth());
}

#[test]
#[should_panic(expected: ('invalid governance message',))]
fn test_upgrade_rejects_wrong_magic() {
    let ctx = deploy_test();
    let pyth = ctx.pyth;

    declare("pyth_fake_upgrade_wrong_magic").unwrap().contract_class();
    pyth.execute_governance_instruction(data::pyth_upgrade_wrong_magic());
}

#[test]
#[should_panic(expected: ('invalid guardian set index',))]
fn update_price_feeds_with_set3_rejects_on_guardian_set4() {
    let wormhole = super::wormhole::deploy_with_mainnet_guardian_set4();
    let ctx = deploy_with_wormhole(wormhole);
    let pyth = ctx.pyth;
    ctx.approve_fee(1000);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
fn update_price_feeds_works_with_guardian_set4() {
    let wormhole = super::wormhole::deploy_with_mainnet_guardian_set4();
    let ctx = deploy_with_wormhole(wormhole);
    let pyth = ctx.pyth;
    ctx.approve_fee(1000);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::unique_update1());
    stop_cheat_caller_address(pyth.contract_address);
}

#[test]
fn update_price_feeds_works_with_guardian_sets_3_4() {
    let wormhole = super::wormhole::deploy_with_mainnet_guardian_sets_3_4();
    let ctx = deploy_with_wormhole(wormhole);
    let pyth = ctx.pyth;
    ctx.approve_fee(2000);
    start_cheat_caller_address(pyth.contract_address, ctx.user.try_into().unwrap());
    pyth.update_price_feeds(data::good_update1());
    pyth.update_price_feeds(data::unique_update1());
    stop_cheat_caller_address(pyth.contract_address);
}

#[derive(Drop, Copy)]
struct Context {
    user: ContractAddress,
    wormhole: IWormholeDispatcher,
    fee_contract: IERC20CamelDispatcher,
    fee_contract2: IERC20CamelDispatcher,
    pyth: IPythDispatcher,
}

#[generate_trait]
impl ContextImpl of ContextTrait {
    fn approve_fee(self: Context, amount: u256) {
        start_cheat_caller_address(self.fee_contract.contract_address, self.user);
        self.fee_contract.approve(self.pyth.contract_address, amount);
        stop_cheat_caller_address(self.fee_contract.contract_address);
    }

    fn approve_fee2(self: Context, amount: u256) {
        start_cheat_caller_address(self.fee_contract2.contract_address, self.user);
        self.fee_contract2.approve(self.pyth.contract_address, amount);
        stop_cheat_caller_address(self.fee_contract2.contract_address);
    }
}

fn deploy_test() -> Context {
    deploy_with_wormhole(super::wormhole::deploy_with_test_guardian())
}

fn deploy_mainnet() -> Context {
    deploy_with_wormhole(super::wormhole::deploy_with_mainnet_guardians())
}

fn deploy_with_wormhole(wormhole: IWormholeDispatcher) -> Context {
    let user = 'user'.try_into().unwrap();
    let fee_class = declare("ERC20Upgradeable").unwrap().contract_class().deref();
    let fee_contract = deploy_fee_contract(fee_class, fee_address1(), user);
    let fee_contract2 = deploy_fee_contract(fee_class, fee_address2(), user);
    let pyth = deploy_pyth_default(
        wormhole.contract_address, fee_contract.contract_address, fee_contract2.contract_address,
    );
    Context { user, wormhole, fee_contract, fee_contract2, pyth }
}

fn deploy_pyth_default(
    wormhole_address: ContractAddress,
    fee_token_address1: ContractAddress,
    fee_token_address2: ContractAddress,
) -> IPythDispatcher {
    deploy_pyth(
        wormhole_address,
        fee_token_address1,
        1000,
        fee_token_address2,
        2000,
        array![
            DataSource {
                emitter_chain_id: 26,
                emitter_address: 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71,
            },
        ],
        1,
        41,
        0,
    )
}

fn deploy_pyth(
    wormhole_address: ContractAddress,
    fee_token_address1: ContractAddress,
    single_update_fee1: u256,
    fee_token_address2: ContractAddress,
    single_update_fee2: u256,
    data_sources: Array<DataSource>,
    governance_emitter_chain_id: u16,
    governance_emitter_address: u256,
    governance_initial_sequence: u64,
) -> IPythDispatcher {
    let mut args = array![];
    (wormhole_address, fee_token_address1, single_update_fee1).serialize(ref args);
    (fee_token_address2, single_update_fee2).serialize(ref args);
    (data_sources, governance_emitter_chain_id).serialize(ref args);
    (governance_emitter_address, governance_initial_sequence).serialize(ref args);
    let contract = declare("pyth").unwrap().contract_class();
    let (contract_address, _) = match contract.deploy(@args) {
        Result::Ok(v) => { v },
        Result::Err(err) => { panic(err) },
    };
    IPythDispatcher { contract_address }
}

fn fee_address1() -> ContractAddress {
    0x1010.try_into().unwrap()
}
fn fee_address2() -> ContractAddress {
    0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7.try_into().unwrap()
}

fn deploy_fee_contract(
    class: ContractClass, at: ContractAddress, recipient: ContractAddress,
) -> IERC20CamelDispatcher {
    let mut args = array![];
    let name: ByteArray = "eth";
    let symbol: ByteArray = "eth";
    let owner: ContractAddress = 1.try_into().unwrap();
    (name, symbol, 100000_u256, recipient, owner).serialize(ref args);
    let (contract_address, _) = match class.deploy_at(@args, at) {
        Result::Ok(v) => { v },
        Result::Err(err) => { panic(err) },
    };
    IERC20CamelDispatcher { contract_address }
}

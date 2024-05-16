use snforge_std::{
    declare, ContractClassTrait, start_prank, stop_prank, CheatTarget, spy_events, SpyOn, EventSpy,
    EventFetcher, event_name_hash, Event
};
use pyth::pyth::{
    IPythDispatcher, IPythDispatcherTrait, DataSource, Event as PythEvent, PriceFeedUpdateEvent
};
use pyth::byte_array::{ByteArray, ByteArrayImpl};
use pyth::util::{array_try_into, UnwrapWithFelt252};
use core::starknet::ContractAddress;
use openzeppelin::token::erc20::interface::{IERC20CamelDispatcher, IERC20CamelDispatcherTrait};
use super::wormhole::corrupted_vm;

fn decode_event(event: @Event) -> PythEvent {
    if *event.keys.at(0) == event_name_hash('PriceFeedUpdate') {
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
    pyth.update_price_feeds(good_update1());
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
    pyth.update_price_feeds(price_update1_test());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let new_balance = fee_contract.balanceOf(user);
    assert!(balance - new_balance == 1000);
    balance = new_balance;
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(governance_set_fee());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(price_update2_test());
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

    let input = corrupted_vm(governance_set_fee(), pos, random1, random2);
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
    pyth.update_price_feeds(price_update1_test());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(governance_set_data_sources());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(price_update2_test_alt_emitter());
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
    pyth.update_price_feeds(price_update1_test());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281060000000);

    pyth.execute_governance_instruction(governance_set_data_sources());

    start_prank(CheatTarget::One(pyth.contract_address), user);
    pyth.update_price_feeds(price_update2_test());
    stop_prank(CheatTarget::One(pyth.contract_address));
    let last_price = pyth
        .get_price_unsafe(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43)
        .unwrap_with_felt252();
    assert!(last_price.price == 6281522520745);
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

// A random update pulled from Hermes.
fn good_update1() -> ByteArray {
    let bytes = array![
        141887862745809943100717722154781668316147089807066324001213790862261653767,
        451230040559159019530944948086670994623010697390864133264612902902585665886,
        355897384610106978643111834734000274494997301794613218547634257521495150151,
        140511063638834349363702006999356227863549404051701803148734324248522745879,
        435849190784772134907557391544163070978531038970298390345939133663347953446,
        416390591179833928094641114955594939466104495718036761707729297119441316151,
        360454929416220920336539568461651500076647166763464050800345920693176904002,
        316054999864337699543932294956493808847640383114707243342262764542081441331,
        325277902980160684959962429721294603784343718796390808940252812862355246813,
        43683235854839458868457367619068018785880460427473556950900276498953667,
        448289429405712011882317781416869052550573589492688760675666957663813001522,
        118081463902430977133121147164253483958565039026724621562859841189218059803,
        194064310618695309465615383754562031677972810736048112738513050109934134235,
        133901765334590923121691219814784557892214901646312752962904032795881821509,
        404227501001709279944936006741063968912686453006275462577777397594240621266,
        81649001731335394114026683805238949464016657447685509824621946636993704965,
        32402065226491532148674904435794801976788068837745943243341272676331333141,
        431262841416902409381606630149292665102873776020834630861578112749151562174,
        6164523115980545628843981978797257048781800754033825701059814297149591186,
        408761574582108996678203805090470134287794603493622537384530614829262728153,
        185368533577943244707350150853170361880334596276529206938783888784867529821,
        173578821500714074579643724957224629379984215847383417303110192934676518530,
        90209855380378362490166376523380463998928070428866100240907090599465187835,
        97758466908511588082569287391708453107999243934457382895073183209581711489,
        132725011490528489913736834798247512772139171145730373610858422315799224432,
        117123868005849140967825260063167768530251411611975150066586827543934313288,
        408149062252618928234854115279677715692278734600386004492580987016428761675,
        164529520317122600276020522906605877985809506451193373524142111430138855019,
        444793051809958482843529748761971363435331354795896511243191618771787268378,
        247660009137502548346315865368477795392972486141407800140910365553760622080,
        3281582060272565111592312037403686940429019548922889497694300188,
        93649805131515836129946966966350066506512123780266587069413066350925286142,
        394112423559676785086098106350541172262729583743734966358666094809121292390,
        35403101004688876764673991514113473446030702766599795822870037077688984558,
        99366103604611980443183454746643823071419076016677225828619807954313149423,
        10381657217606191031071521950784155484751645280452344547752823767622424055,
        391045354044274401116419632681482293741435113770205621235865697077178955228,
        311250087759201408758984550959714865999349469611700431708031036894849650573,
        59953730895385399344628932835545900304309851622811198425230584225200786697,
        226866843267230707879834616967256711063296411939069440476882347301771901839,
        95752383404870925303422787,
    ];
    ByteArrayImpl::new(array_try_into(bytes), 11)
}

// Generated with `../../tools/test_vaas/src/bin/generate_wormhole_vaas.rs`
fn governance_set_fee() -> ByteArray {
    ByteArrayImpl::new(
        array_try_into(
            array![
                1766847064779993955862540543984267022910717161432209540262366788014689913,
                322968519187498395396360816568387642032723484530650782503164941848016432477,
                407975527128964115747680681091773270935844489133353741223501742992990928896,
                49565958604199796163020368,
                8072278384728444780182694421117884443886221966887092226,
            ]
        ),
        23
    )
}

// Generated with `../../tools/test_vaas/src/bin/generate_wormhole_vaas.rs`
fn governance_set_data_sources() -> ByteArray {
    ByteArrayImpl::new(
        array_try_into(
            array![
                1766847064779993795984967344618836356750759980724568847727566676204733945,
                319252252405206634291073190903653114488682078063415369176250618646860635118,
                427774687951454487776318063357824898404188691225649546174530713404617785344,
                49565958604199796163020368,
                148907253454411774545738931219166892876160512393929267898119961543514185585,
                223938022913800988696085410923418445187967252047785407181969631814277398528,
                301,
            ]
        ),
        14
    )
}

// Generated with `../../tools/test_vaas/src/bin/re_sign_price_updates.rs`
fn price_update1_test() -> ByteArray {
    ByteArrayImpl::new(
        array_try_into(
            array![
                141887862745809943100421399774809552050876420277163116849842965275903806689,
                210740906737592158039211995620336526131859667363627655742687286503264782608,
                437230063624699337579360546580839669896712252828825008570863758867641146081,
                3498691308882995183871222184377409432186747119716981166996399082193594993,
                1390200166945919815453709407753165121175395927094647129599868236,
                222819573728193325268644030206737371345667885599602384508424089704440116301,
                341318259000017461738706238280879290398059773267212529438772847337449455616,
                1275126645346645395843037504005879519843596923369759718556759844520336145,
                363528783578153760894082184744116718493621815898909809604883433584616420886,
                301537311768214106147206781423041990995720118715322906821301413003463484347,
                83150006264761451992768264969047148434524798781124754530141755679159432208,
                96387772316726941183358990094337324283641753573556594738287498821253761827,
                395908154570808692326126405856049827157095768069251211022053821585519235652,
                87135893730137265929093180553063146337041045646221968026289709394440932141,
                245333243912241114598596888050489286502591033459250287888834,
            ]
        ),
        25
    )
}

// Generated with `../../tools/test_vaas/src/bin/re_sign_price_updates.rs`
fn price_update2_test() -> ByteArray {
    ByteArrayImpl::new(
        array_try_into(
            array![
                141887862745809943100421399774809552050874823427618844548942380383465221086,
                106893583704677921907497845070624642590618427233243792006390965895909696183,
                126617671723931969110123875642449115250793288301361049879364132884271078113,
                3498691308882995183871222184377409432186747119716981166996399082193594993,
                1390200461185063661704370212555794334034815850290352693418762308,
                419598057710749587537080281518289024699150505326900462079484531390510117965,
                341318259000017461738706238280879290398059773267212529438780607147892801536,
                1437437604754599821041091415535991441313586347841485651963630208563420739,
                305222830440467078008666830004555943609735125691441831219591213494068931362,
                358396406696718360717615797531477055540194104082154743994717297650279402646,
                429270385827211102844129651648706540139690432947840438198166022904666187018,
                343946166212648899477337159288779715507980257611242783073384876024451565860,
                67853010773876862913176476530730880916439012004585961528150130218675908823,
                370855179649505412564259994413632062925303311800103998016489412083011059699,
                1182295126766215829784496273374889928477877265080355104888778,
            ]
        ),
        25
    )
}

// Generated with `../../tools/test_vaas/src/bin/re_sign_price_updates.rs`
// (same as `price_update2_test()` but with a different emitter)
fn price_update2_test_alt_emitter() -> ByteArray {
    ByteArrayImpl::new(
        array_try_into(
            array![
                141887862745809943100421399774809552050876183715022494587482285730295850458,
                359963320496358929787450247990998878269668655936959553372924597144593948268,
                168294065609209340478050191639515428002729901421915929480902120205187023616,
                301,
                1390200461185063661704370212555794334034815850290352693418762308,
                419598057710749587537080281518289024699150505326900462079484531390510117965,
                341318259000017461738706238280879290398059773267212529438780607147892801536,
                1437437604754599821041091415535991441313586347841485651963630208563420739,
                305222830440467078008666830004555943609735125691441831219591213494068931362,
                358396406696718360717615797531477055540194104082154743994717297650279402646,
                429270385827211102844129651648706540139690432947840438198166022904666187018,
                343946166212648899477337159288779715507980257611242783073384876024451565860,
                67853010773876862913176476530730880916439012004585961528150130218675908823,
                370855179649505412564259994413632062925303311800103998016489412083011059699,
                1182295126766215829784496273374889928477877265080355104888778,
            ]
        ),
        25
    )
}

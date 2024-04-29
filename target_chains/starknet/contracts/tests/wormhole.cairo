use snforge_std::{declare, ContractClassTrait, start_prank, stop_prank, CheatTarget};
use pyth::wormhole::{IWormholeDispatcher, IWormholeDispatcherTrait, ParseAndVerifyVmError};
use pyth::reader::ReaderImpl;
use pyth::byte_array::{ByteArray, ByteArrayImpl};
use pyth::util::{UnwrapWithFelt252, array_felt252_to_bytes31};
use core::starknet::ContractAddress;
use core::panic_with_felt252;

#[test]
fn test_parse_and_verify_vm_works() {
    let owner = 'owner'.try_into().unwrap();
    let dispatcher = deploy_and_init(owner);

    let vm = dispatcher.parse_and_verify_vm(good_vm1()).unwrap();
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
    assert!(reader.read_u8().unwrap() == 65);
    assert!(reader.read_u8().unwrap() == 85);
    assert!(reader.read_u8().unwrap() == 87);
}

#[test]
#[fuzzer(runs: 100, seed: 0)]
#[should_panic(expected: ('any_expected',))]
fn test_parse_and_verify_vm_rejects_corrupted_vm(pos: usize, random1: usize, random2: usize) {
    let owner = 'owner'.try_into().unwrap();
    let dispatcher = deploy_and_init(owner);

    let r = dispatcher.parse_and_verify_vm(corrupted_vm(pos, random1, random2));
    match r {
        Result::Ok(v) => { println!("no error, output: {:?}", v); },
        Result::Err(err) => {
            if err == ParseAndVerifyVmError::InvalidSignature
                || err == ParseAndVerifyVmError::InvalidGuardianIndex
                || err == ParseAndVerifyVmError::InvalidGuardianSetIndex
                || err == ParseAndVerifyVmError::VmVersionIncompatible
                || err == ParseAndVerifyVmError::Reader(pyth::reader::Error::UnexpectedEndOfInput) {
                panic_with_felt252('any_expected');
            } else {
                panic_with_felt252(err.into());
            }
        },
    }
}

#[test]
#[should_panic(expected: ('access denied',))]
fn test_submit_guardian_set_rejects_wrong_owner() {
    let owner = 'owner'.try_into().unwrap();
    let dispatcher = deploy(owner, guardian_set1());
    start_prank(CheatTarget::One(dispatcher.contract_address), 'baddy'.try_into().unwrap());
    dispatcher.submit_new_guardian_set(1, guardian_set1()).unwrap_with_felt252();
}

#[test]
#[should_panic(expected: ('invalid guardian set sequence',))]
fn test_submit_guardian_set_rejects_wrong_index() {
    let owner = 'owner'.try_into().unwrap();
    let dispatcher = deploy(owner, guardian_set1());

    start_prank(CheatTarget::One(dispatcher.contract_address), owner.try_into().unwrap());
    dispatcher.submit_new_guardian_set(1, guardian_set1()).unwrap_with_felt252();
    dispatcher.submit_new_guardian_set(3, guardian_set3()).unwrap_with_felt252();
}

#[test]
#[should_panic(expected: ('no guardians specified',))]
fn test_deploy_rejects_empty() {
    let owner = 'owner'.try_into().unwrap();
    deploy(owner, array![]);
}

#[test]
#[should_panic(expected: ('no guardians specified',))]
fn test_submit_guardian_set_rejects_empty() {
    let owner = 'owner'.try_into().unwrap();
    let dispatcher = deploy(owner, guardian_set1());

    start_prank(CheatTarget::One(dispatcher.contract_address), owner.try_into().unwrap());
    dispatcher.submit_new_guardian_set(1, array![]).unwrap_with_felt252();
}

fn deploy(owner: ContractAddress, guardians: Array<felt252>) -> IWormholeDispatcher {
    let mut args = array![];
    (owner, guardians).serialize(ref args);
    let contract = declare("wormhole");
    let contract_address = match contract.deploy(@args) {
        Result::Ok(v) => { v },
        Result::Err(err) => {
            panic(err.panic_data);
            0.try_into().unwrap()
        },
    };
    IWormholeDispatcher { contract_address }
}

pub fn deploy_and_init(owner: ContractAddress) -> IWormholeDispatcher {
    let dispatcher = deploy(owner, guardian_set1());

    start_prank(CheatTarget::One(dispatcher.contract_address), owner.try_into().unwrap());
    dispatcher.submit_new_guardian_set(1, guardian_set1()).unwrap_with_felt252();
    dispatcher.submit_new_guardian_set(2, guardian_set2()).unwrap_with_felt252();
    dispatcher.submit_new_guardian_set(3, guardian_set3()).unwrap_with_felt252();
    stop_prank(CheatTarget::One(dispatcher.contract_address));

    dispatcher
}

fn corrupted_vm(pos: usize, random1: usize, random2: usize) -> ByteArray {
    let mut new_data = array![];

    let mut real_data = good_vm1();
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

// Below are actual guardian keys from
// https://github.com/wormhole-foundation/wormhole-networks/tree/master/mainnetv2/guardianset
fn guardian_set1() -> Array<felt252> {
    array![
        0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5,
        0xfF6CB952589BDE862c25Ef4392132fb9D4A42157,
        0x114De8460193bdf3A2fCf81f86a09765F4762fD1,
        0x107A0086b32d7A0977926A205131d8731D39cbEB,
        0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2,
        0x11b39756C042441BE6D8650b69b54EbE715E2343,
        0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd,
        0xeB5F7389Fa26941519f0863349C223b73a6DDEE7,
        0x74a3bf913953D695260D88BC1aA25A4eeE363ef0,
        0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e,
        0xAF45Ced136b9D9e24903464AE889F5C8a723FC14,
        0xf93124b7c738843CBB89E864c862c38cddCccF95,
        0xD2CC37A4dc036a8D232b48f62cDD4731412f4890,
        0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811,
        0x71AA1BE1D36CaFE3867910F99C09e347899C19C3,
        0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf,
        0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8,
        0x5E1487F35515d02A92753504a8D75471b9f49EdB,
        0x6FbEBc898F403E4773E95feB15E80C9A99c8348d,
    ]
}
fn guardian_set2() -> Array<felt252> {
    array![
        0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5,
        0xfF6CB952589BDE862c25Ef4392132fb9D4A42157,
        0x114De8460193bdf3A2fCf81f86a09765F4762fD1,
        0x107A0086b32d7A0977926A205131d8731D39cbEB,
        0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2,
        0x11b39756C042441BE6D8650b69b54EbE715E2343,
        0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd,
        0x66B9590e1c41e0B226937bf9217D1d67Fd4E91F5,
        0x74a3bf913953D695260D88BC1aA25A4eeE363ef0,
        0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e,
        0xAF45Ced136b9D9e24903464AE889F5C8a723FC14,
        0xf93124b7c738843CBB89E864c862c38cddCccF95,
        0xD2CC37A4dc036a8D232b48f62cDD4731412f4890,
        0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811,
        0x71AA1BE1D36CaFE3867910F99C09e347899C19C3,
        0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf,
        0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8,
        0x5E1487F35515d02A92753504a8D75471b9f49EdB,
        0x6FbEBc898F403E4773E95feB15E80C9A99c8348d,
    ]
}
fn guardian_set3() -> Array<felt252> {
    array![
        0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5,
        0xfF6CB952589BDE862c25Ef4392132fb9D4A42157,
        0x114De8460193bdf3A2fCf81f86a09765F4762fD1,
        0x107A0086b32d7A0977926A205131d8731D39cbEB,
        0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2,
        0x11b39756C042441BE6D8650b69b54EbE715E2343,
        0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd,
        0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20,
        0x74a3bf913953D695260D88BC1aA25A4eeE363ef0,
        0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e,
        0xAF45Ced136b9D9e24903464AE889F5C8a723FC14,
        0xf93124b7c738843CBB89E864c862c38cddCccF95,
        0xD2CC37A4dc036a8D232b48f62cDD4731412f4890,
        0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811,
        0x71AA1BE1D36CaFE3867910F99C09e347899C19C3,
        0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf,
        0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8,
        0x5E1487F35515d02A92753504a8D75471b9f49EdB,
        0x6FbEBc898F403E4773E95feB15E80C9A99c8348d,
    ]
}

// A random VAA pulled from Hermes.
fn good_vm1() -> ByteArray {
    let bytes = array![
        1766847066033410293701000231337210964058791470455465385734308943533652138,
        250126301534699068413432844632573953364878937343368310395142095034982913232,
        374780571002258088211231890250917843593951765403462661483498298003400611238,
        23190137343211334092589308306056431640588154666326612124726174150537328574,
        238750269065878649216923353030193912502813798896051725498208457553032584635,
        29844190303057534696518006438077948796328243878877072296680853158289181326,
        106329507856770018708432343978518079724691760719405501795955774399597471533,
        50779865592261858016477142415230454208001695486195806892438697217059319645,
        448669871976126446102256476358498380455807705600424321390063431836375575318,
        115682669871397824853706713833773246708114483862317474710603223566297521279,
        301634766618012930739391408723909107532790832406455099966028276947414082504,
        104473166230846104217366042152018649207811514257244625711402436055500423094,
        64445621634231668761998815864645440965239569561546522651415024970517905416,
        192317190225976528694195501079591384434869624408066864018183189813956862386,
        289982656017597431343118552054719821766658675456661448685110903889153449006,
        218840601196095059731241556733624112758673153548932709011933806481899680620,
        430933799927481265070475198137531816946660368757134588278434352703899277070,
        69322998883710289192076494057541346430050879299268159627180404869988632073,
        23862615839737051269352321086490452186237833007444069999578906611768140646,
        444634264607471510688862284107804392707600799506487897206707262445172121289,
        438038196736233160320436150616293672539386464061037100698335568417587662951,
        4682255185797880874381673193118803274635247527626050223938224759013169366,
        337620725992972686809095065321563509600769533202700218393281926304544120094,
        106657917096532484607371891267699639824731774168349872862335217581425289654,
        71240348385993236445536577509595968468284689483611375124653855125285401592,
        347603391821038175842934311068097986460257977131947418186118379296987051086,
        414263571545410645948841360836383289766662078574048514890988877286444618669,
        250301638008739107522011802538487063969565433276260914336890309092111026583,
        43192785595291340058788190601908070333310658291317702311902081,
        52685537088250779930155363779405986390839624071318818148325576008719597568,
        14615204155786886573933667335033405822686404253588533,
    ];
    ByteArrayImpl::new(array_felt252_to_bytes31(bytes), 22)
}

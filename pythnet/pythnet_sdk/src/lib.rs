pub mod accumulators;
pub mod hashers;
pub mod payload;
pub mod wormhole;

pub(crate) type Pubkey = [u8; 32];
pub(crate) type PriceId = Pubkey;

/// Pubkey::find_program_address(&[b"emitter"], &sysvar::accumulator::id());
/// pubkey!("G9LV2mp9ua1znRAfYwZz5cPiJMAbo1T6mbjdQsDZuMJg");
pub const ACCUMULATOR_EMITTER_ADDR: Pubkey = [
    225, 1, 250, 237, 172, 88, 81, 227, 43, 155, 35, 181, 249, 65, 26, 140, 43, 172, 74, 174, 62,
    212, 221, 123, 129, 29, 209, 167, 46, 164, 170, 113,
];

/// Pubkey::find_program_address(&[b"Sequence", &emitter_pda_key.to_bytes()], &WORMHOLE_PID);
/// pubkey!("HiqU8jiyUoFbRjf4YFAKRFWq5NZykEYC6mWhXXnoszJR");
pub const ACCUMULATOR_SEQUENCE_ADDR: Pubkey = [
    248, 114, 155, 82, 154, 159, 139, 78, 187, 144, 5, 110, 22, 123, 227, 191, 18, 224, 118, 212,
    39, 87, 137, 86, 88, 211, 220, 104, 229, 255, 139, 70,
];

/// Official Pyth Program Address
/// pubkey!("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH");
pub const PYTH_PID: Pubkey = [
    220, 229, 235, 225, 228, 156, 59, 159, 17, 76, 181, 84, 76, 80, 169, 158, 192, 214, 146, 214,
    63, 86, 121, 90, 224, 41, 172, 131, 217, 234, 139, 226,
];

/// Official Wormhole Program Address
/// pubkey!("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth");
pub const WORMHOLE_PID: Pubkey = [
    224, 165, 137, 164, 26, 85, 251, 214, 108, 82, 164, 117, 242, 217, 42, 109, 61, 201, 180, 116,
    113, 20, 203, 154, 248, 37, 169, 139, 84, 93, 60, 224,
];

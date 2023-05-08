pub mod accumulators;
pub mod hashers;
pub mod payload;
pub mod wormhole;

pub(crate) type Pubkey = [u8; 32];
pub(crate) type PriceId = Pubkey;

/// Official Message Buffer Program Id
/// pubkey!("Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM");
const MESSAGE_BUFFER_PID: Pubkey = [
    7, 83, 149, 9, 30, 102, 77, 194, 50, 151, 133, 40, 118, 10, 93, 152, 174, 44, 244, 56, 27, 47,
    234, 218, 173, 153, 254, 48, 102, 178, 128, 18,
];

/// Pubkey::find_program_address(&[b"emitter"], &sysvar::accumulator::id());
/// pubkey!("G9LV2mp9ua1znRAfYwZz5cPiJMAbo1T6mbjdQsDZuMJg");
const ACCUMULATOR_EMITTER_ADDRESS: Pubkey = [
    225, 1, 250, 237, 172, 88, 81, 227, 43, 155, 35, 181, 249, 65, 26, 140, 43, 172, 74, 174, 62,
    212, 221, 123, 129, 29, 209, 167, 46, 164, 170, 113,
];

/// Official Program IDs and Addresses on Pythnet
pub mod pythnet {
    use super::Pubkey;
    /// Official Wormhole Program Address on Pythnet
    /// pubkey!("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU");
    pub const WORMHOLE_PID: Pubkey = [
        238, 106, 51, 154, 165, 236, 145, 158, 20, 176, 156, 210, 101, 132, 136, 107, 95, 235, 248,
        189, 230, 34, 185, 117, 208, 26, 214, 142, 191, 11, 208, 35,
    ];

    /// Pubkey::find_program_address(&[b"Sequence", &emitter_pda_key.to_bytes()], &WORMHOLE_PID);
    /// pubkey!("HiqU8jiyUoFbRjf4YFAKRFWq5NZykEYC6mWhXXnoszJR");
    pub const ACCUMULATOR_SEQUENCE_ADDR: Pubkey = [
        109, 92, 198, 114, 10, 119, 5, 31, 13, 197, 193, 195, 132, 17, 12, 3, 77, 111, 158, 247,
        194, 137, 236, 50, 8, 185, 1, 61, 85, 94, 54, 198,
    ];

    /// Official Pyth Oracle Program Id on Pythnet
    /// pubkey!("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH");
    pub const PYTH_PID: Pubkey = [
        220, 229, 235, 225, 228, 156, 59, 159, 17, 76, 181, 84, 76, 80, 169, 158, 192, 214, 146,
        214, 63, 86, 121, 90, 224, 41, 172, 131, 217, 234, 139, 226,
    ];
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    #[test]
    fn test_pubkeys() {
        use solana_sdk::{
            pubkey,
            pubkey::Pubkey,
        };

        let accumulator_emitter_address = pubkey!("G9LV2mp9ua1znRAfYwZz5cPiJMAbo1T6mbjdQsDZuMJg");
        assert_eq!(
            ACCUMULATOR_EMITTER_ADDRESS,
            accumulator_emitter_address.to_bytes()
        );

        let pythnet_wormhole_pid = pubkey!("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU");
        let (pythnet_accumulator_sequence_address, _) = Pubkey::find_program_address(
            &[b"Sequence", accumulator_emitter_address.as_ref()],
            &pythnet_wormhole_pid,
        );

        assert_eq!(pythnet::WORMHOLE_PID, pythnet_wormhole_pid.to_bytes());
        assert_eq!(
            pythnet::ACCUMULATOR_SEQUENCE_ADDR,
            pythnet_accumulator_sequence_address.to_bytes()
        );

        let pythtest_wormhole_pid = pubkey!("EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z");
        let pythtest_wormhole_pid_bytes: [u8; 32] = [
            200, 74, 124, 198, 226, 194, 215, 62, 43, 98, 207, 184, 167, 181, 175, 174, 254, 192,
            204, 37, 26, 45, 137, 21, 180, 83, 228, 241, 198, 180, 129, 67,
        ];
        let (pythtest_accumulator_sequence_address, _) = Pubkey::find_program_address(
            &[b"Sequence", accumulator_emitter_address.as_ref()],
            &pythtest_wormhole_pid,
        );

        let pythtest_accumulator_sequence_address_bytes: [u8; 32] = [
            145, 134, 75, 61, 141, 252, 86, 178, 3, 223, 183, 153, 46, 227, 25, 201, 125, 199, 176,
            254, 164, 55, 141, 20, 218, 150, 11, 104, 109, 137, 13, 166,
        ];

        assert_eq!(
            pythtest_wormhole_pid_bytes,
            pythtest_wormhole_pid.to_bytes()
        );

        assert_eq!(
            pythtest_accumulator_sequence_address_bytes,
            pythtest_accumulator_sequence_address.to_bytes()
        );

        let message_buffer_program = pubkey!("Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM");
        assert_eq!(MESSAGE_BUFFER_PID, message_buffer_program.to_bytes());
    }
}

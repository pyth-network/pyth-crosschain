mod signature;

pub use {
    pyth_lazer_protocol as protocol,
    signature::{
        ed25519_program_args, signature_offsets, verify_message, Ed25519SignatureOffsets,
        VerifiedMessage,
    },
};

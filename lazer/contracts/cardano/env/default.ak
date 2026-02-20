pub const chain_id: Int = 60095

// Certus One:
// https://github.com/wormhole-foundation/wormhole/blob/fe93c28401ea42bc4e62450ddaf5083110802e78/guardianset/mainnetv2/v1.prototxt#L7
pub const initial_guardians: List<ByteArray> =
  [#"58cc3ae5c097b213ce3c81979e1b9f9570746aa5"]

pub const withdraw_script_expiration_ms: Int = 1000 * 60 * 60 * 24 * 2

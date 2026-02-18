use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use secp256k1
use state_home
use wormhole.{Guardians}
use wormhole/governance
use wormhole/vaa.{VAA}

const genesis: Guardians =
  Guardians {
    set_index: 0,
    // Certus One:
    // https://github.com/wormhole-foundation/wormhole/blob/fe93c28401ea42bc4e62450ddaf5083110802e78/guardianset/mainnetv2/v1.prototxt#L7
    set: [#"58cc3ae5c097b213ce3c81979e1b9f9570746aa5"],
  }

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Never, id: PolicyId, self: Transaction) {
    let state <- state_home.mint(origin, home, id, self)
    expect guardians: Guardians = state
    guardians == genesis
  }

  else(_) {
    fail
  }
}

/// Upgrade VAA with needed preprocessing done off-chain
pub type PreparedUpgrade {
  vaa: ByteArray,
  recovered_keys: List<ByteArray>,
}

validator update {
  spend(
    old: Option<Data>,
    upgrade: PreparedUpgrade,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let old, new <- state_home.spend(old, utxo, self)
    expect old: Guardians = old
    expect new: Guardians = new
    is_valid_guardians_upgrade(old, new, upgrade)
  }

  else(_) {
    fail
  }
}

fn is_valid_guardians_upgrade(
  old: Guardians,
  new: Guardians,
  upgrade: PreparedUpgrade,
) {
  let keys = list.map(upgrade.recovered_keys, secp256k1.public_key)
  let VAA { body, .. } = vaa.parse_and_verify(upgrade.vaa, old, keys)
  let parsed = governance.parse_guardian_set_upgrade(body.payload)
  and {
    (body.emitter_chain == governance.emitter_chain)?,
    (body.emitter_address == governance.emitter_address)?,
    (parsed == new)?,
  }
}

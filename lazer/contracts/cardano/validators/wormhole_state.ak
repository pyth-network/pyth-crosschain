use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use state.{State}
use wormhole.{Guardians}
use wormhole/governance
use wormhole/vaa.{PreparedVAA}

const genesis: Guardians =
  Guardians {
    seen_sequence: 0,
    set_index: 0,
    // Certus One:
    // https://github.com/wormhole-foundation/wormhole/blob/fe93c28401ea42bc4e62450ddaf5083110802e78/guardianset/mainnetv2/v1.prototxt#L7
    set: [#"58cc3ae5c097b213ce3c81979e1b9f9570746aa5"],
  }

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Data, id: PolicyId, self: Transaction) {
    let state <- state.mint(origin, id, self)
    expect guardians: Guardians = state.data
    (state.home == home)? && (guardians == genesis)?
  }

  else(_) {
    fail
  }
}

validator update {
  spend(
    old: Option<Guardians>,
    upgrade: PreparedVAA,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let old, _ <- state.spend(old, utxo, self)
    state.new(
      old.home,
      governance.parse_and_verify_guardian_set_upgrade(upgrade, old.data),
    )
  }

  else(_) {
    fail
  }
}

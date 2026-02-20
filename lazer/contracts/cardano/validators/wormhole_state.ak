use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use env
use state.{State, StateConfig}
use wormhole.{Guardians}
use wormhole/governance
use wormhole/vaa.{PreparedVAA}

const genesis: Guardians =
  Guardians { seen_sequence: 0, set_index: 0, set: env.initial_guardians }

pub const config =
  StateConfig { state_nft: "Pyth Wormhole", owner_nft: "Pyth Wormhole Ops" }

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Never, id: PolicyId, self: Transaction) {
    let state <- state.mint(config, origin, id, self)
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
    let old, _ <- state.spend(config, old, utxo, self)
    state.new(
      old.home,
      governance.parse_and_verify_guardian_set_upgrade(upgrade, old.data),
    )
  }

  else(_) {
    fail
  }
}

use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use pyth/governance.{UpdateTrustedSigner}
use pyth/update.{TrustedSigner, TrustedSigners} as pyth
use state_home
use types/u16
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA, VAA}

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Data, id: PolicyId, self: Transaction) {
    let state <- state_home.mint(origin, home, id, self)
    expect signers: TrustedSigners = state
    list.is_empty(signers.set)?
  }

  else(_) {
    fail
  }
}

validator update {
  spend(
    old: Option<TrustedSigners>,
    upgrade: PreparedVAA,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let old, new <- state_home.spend(old, utxo, self)
    expect new: TrustedSigners = new
    expect guardians: Guardians =
      state_home.find_state(old.governance.guardians, self.reference_inputs)
    is_valid_signers_upgrade(old, new, upgrade, guardians)?
  }

  else(_) {
    fail
  }
}

fn is_valid_signers_upgrade(
  old: TrustedSigners,
  new: TrustedSigners,
  upgrade: PreparedVAA,
  guardians: Guardians,
) -> Bool {
  let VAA { body, .. } = vaa.parse_and_verify_prepared(upgrade, guardians)
  let UpdateTrustedSigner(signer) =
    governance.parse_governance_action(body.payload)
  and {
    (u16.as_int(body.emitter_chain) == old.governance.emitter_chain)?,
    (body.emitter_address == old.governance.emitter_address)?,
    is_valid_signer_update(old.set, new.set, signer)?,
  }
}

fn is_valid_signer_update(
  old: List<TrustedSigner>,
  new: List<TrustedSigner>,
  change: TrustedSigner,
) -> Bool {
  if change.expires_at == 0 {
    new == list.filter(old, fn(trusted) { trusted.key != change.key })
  } else {
    new == list.map(
      old,
      fn(trusted) {
        if trusted.key == change.key {
          change
        } else {
          trusted
        }
      },
    )
  }
}

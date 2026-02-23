use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/interval
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction, ValidityRange}
use pyth/governance.{
  Governance, UpdateTrustedSigner, UpgradeSpendScript, UpgradeWithdrawScript,
}
use pyth/update.{TrustedSigner, TrustedSigners} as pyth
use state.{State, StateConfig}
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA}
use wormhole_state

pub type Pyth {
  governance: Governance,
  trusted_signers: TrustedSigners,
  deprecated_withdraw_scripts: Pairs<ValidityRange, ScriptHash>,
  withdraw_script: ScriptHash,
}

pub const config =
  StateConfig { state_nft: "Pyth State", owner_nft: "Pyth Ops" }

pub fn is_active_withdraw_script(
  self: Pyth,
  range: ValidityRange,
  hash: ScriptHash,
) -> Bool {
  (self.withdraw_script == hash)? || list.any(
    self.deprecated_withdraw_scripts,
    fn(Pair(validity, deprecated)) {
      (deprecated == hash)? && interval.includes(validity, range)?
    },
  )
}

pub type Action {
  GovernanceAction(PreparedVAA)
  PurgeExpiredWithdrawScripts
}

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Never, id: PolicyId, self: Transaction) {
    let state <- state.mint(config, origin, id, self)
    expect pyth: Pyth = state.data
    and {
      (state.home == home)?,
      (pyth.governance.seen_sequence == 0)?,
    }
  }

  else(_) {
    fail
  }
}

validator update {
  spend(
    old: Option<Pyth>,
    action: Action,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let state, is_owner <- state.spend(config, old, utxo, self)
    let pyth = state.data
    expect guardians: Guardians =
      state.find(
        wormhole_state.config,
        pyth.governance.wormhole,
        self.reference_inputs,
      )

    when action is {
      GovernanceAction(action) -> {
        let (action, governance) =
          governance.parse_and_verify_action(action, pyth.governance, guardians)
        let pyth = Pyth { ..pyth, governance }
        when action is {
          UpdateTrustedSigner(signer) -> {
            let pyth =
              Pyth {
                ..pyth,
                trusted_signers: update_trusted_signer(
                  pyth.trusted_signers,
                  signer,
                ),
              }
            state.new(state.home, pyth)
          }
          UpgradeSpendScript(hash) -> state.new(hash, pyth)
          UpgradeWithdrawScript { deprecated_validity, new_script } -> {
            let pyth =
              Pyth {
                ..pyth,
                withdraw_script: new_script,
                deprecated_withdraw_scripts: [
                  Pair(deprecated_validity, pyth.withdraw_script),
                  ..pyth.deprecated_withdraw_scripts
                ],
              }
            state.new(state.home, pyth)
          }
        }
      }
      PurgeExpiredWithdrawScripts -> {
        expect is_owner?
        let pyth =
          Pyth {
            ..pyth,
            deprecated_withdraw_scripts: purge_expired_scripts(
              pyth.deprecated_withdraw_scripts,
              self.validity_range,
            ),
          }
        state.new(state.home, pyth)
      }
    }
  }

  else(_) {
    fail
  }
}

fn update_trusted_signer(signers: TrustedSigners, signer: TrustedSigner) {
  if signer.expires_at == 0 {
    list.filter(signers, fn(trusted) { trusted.key != signer.key })
  } else {
    list.map(
      signers,
      fn(trusted) {
        if trusted.key == signer.key {
          signer
        } else {
          trusted
        }
      },
    )
  }
}

pub fn purge_expired_scripts(
  scripts: Pairs<ValidityRange, ScriptHash>,
  valid: ValidityRange,
) -> Pairs<ValidityRange, ScriptHash> {
  list.filter(
    scripts,
    fn(Pair(range, _)) {
      !interval.is_empty(interval.intersection(range, valid))
    },
  )
}

test keeps_valid_withdraw_script() {
  let scripts = [Pair(interval.between(1, 5), #"")]
  purge_expired_scripts(scripts, interval.between(3, 7)) == scripts
}

test purges_invalid_withdraw_script() {
  let scripts = [Pair(interval.between(1, 5), #"")]
  purge_expired_scripts(scripts, interval.between(6, 11)) == []
}

use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/interval.{Finite, IntervalBound, NegativeInfinity, PositiveInfinity}
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction, ValidityRange}
use pyth/governance.{
  Governance, UpdateTrustedSigner, UpgradeSpendScript, UpgradeWithdrawScript,
}
use pyth/update.{TrustedSigner, TrustedSigners} as pyth
use state.{State}
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA}

pub type Pyth {
  governance: Governance,
  trusted_signers: TrustedSigners,
  deprecated_withdraw_scripts: Pairs<ValidityRange, ScriptHash>,
  withdraw_script: ScriptHash,
}

pub type Action {
  GovernanceAction(PreparedVAA)
  PurgeExpiredWithdrawScripts
}

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Data, id: PolicyId, self: Transaction) {
    let state <- state.mint(origin, id, self)
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
    let state, is_owner <- state.spend(old, utxo, self)
    let pyth = state.data
    expect guardians: Guardians =
      state.find(pyth.governance.guardians, self.reference_inputs)

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

fn purge_expired_scripts(
  scripts: Pairs<ValidityRange, ScriptHash>,
  interval: ValidityRange,
) -> Pairs<ValidityRange, ScriptHash> {
  let valid = entirely_before_range(interval)
  list.filter(
    scripts,
    fn(Pair(range, _)) {
      !interval.is_empty(interval.intersection(valid, range))
    },
  )
}

fn entirely_before_range(self: ValidityRange) -> ValidityRange {
  when self.lower_bound is {
    IntervalBound { bound_type: Finite(bound), is_inclusive } ->
      if is_inclusive {
        interval.entirely_before(bound)
      } else {
        interval.before(bound)
      }
    IntervalBound { bound_type: NegativeInfinity, .. } -> interval.empty
    IntervalBound { bound_type: PositiveInfinity, .. } -> interval.everything
  }
}

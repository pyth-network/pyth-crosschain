use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/interval
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction, ValidityRange}
use pyth.{Governance, Pyth}
use pyth/governance.{
  UpdateTrustedSigner, UpgradeSpendScript, UpgradeWithdrawScript,
}
use pyth/message
use state.{State, StateConfig}
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA}
use wormhole_state

pub const config =
  StateConfig { state_nft: "Pyth State", owner_nft: "Pyth Ops" }

pub type Action {
  GovernanceAction(PreparedVAA)
  PurgeExpiredWithdrawScripts
}

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Never, id: PolicyId, self: Transaction) {
    let state <- state.mint(config, origin, id, self)
    expect Pyth {
      governance,
      trusted_signers,
      deprecated_withdraw_scripts,
      withdraw_script,
    }: Pyth = state.data
    and {
      state.home == home,
      governance.seen_sequence == 0,
      trusted_signers == [],
      deprecated_withdraw_scripts == [],
      state.reference_script == Some(withdraw_script),
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
      GovernanceAction(action) ->
        execute_governance_action(state, action, guardians)
      PurgeExpiredWithdrawScripts -> {
        expect is_owner
        state.new(
          state.home,
          Pyth {
            ..state.data,
            deprecated_withdraw_scripts: purge_expired_scripts(
              state.data.deprecated_withdraw_scripts,
              self.validity_range,
            ),
          },
          state.reference_script,
        )
      }
    }
  }

  else(_) {
    fail
  }
}

pub fn execute_governance_action(
  state: State<Pyth>,
  action: PreparedVAA,
  guardians: Guardians,
) {
  let pyth = state.data
  let (action, governance) =
    governance.parse_and_verify_action(action, pyth.governance, guardians)
  let pyth = Pyth { ..pyth, governance }
  when action is {
    UpdateTrustedSigner(key, valid) -> {
      let pyth =
        Pyth {
          ..pyth,
          trusted_signers: message.update_trusted_signer(
            pyth.trusted_signers,
            key,
            valid,
          ),
        }
      state.new(state.home, pyth, state.reference_script)
    }
    UpgradeSpendScript(hash) -> state.new(hash, pyth, state.reference_script)
    UpgradeWithdrawScript { new_script, previous_validity } -> {
      let pyth =
        Pyth {
          ..pyth,
          withdraw_script: new_script,
          deprecated_withdraw_scripts: [
            Pair(previous_validity, pyth.withdraw_script),
            ..pyth.deprecated_withdraw_scripts
          ],
        }
      state.new(state.home, pyth, Some(new_script))
    }
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

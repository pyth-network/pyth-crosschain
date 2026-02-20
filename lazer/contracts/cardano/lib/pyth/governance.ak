use aiken/crypto.{ScriptHash}
use aiken/interval
use cardano/transaction.{ValidityRange}
use env
use parser.{Parser, parse}
use pyth/update.{TrustedSigner}
use state.{StateId}
use types/u16
use types/u32.{U32}
use types/u64
use types/u8.{U8}
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA, VAA}

const governance_action_magic: ByteArray = "PTGM"

const governance_action_module: U8 = u8.from_int(3)

pub type Governance {
  wormhole: StateId,
  emitter_chain: Int,
  emitter_address: ByteArray,
  seen_sequence: Int,
}

pub type GovernanceAction {
  UpdateTrustedSigner(TrustedSigner)
  UpgradeSpendScript(ScriptHash)
  UpgradeWithdrawScript {
    deprecated_validity: ValidityRange,
    new_script: ScriptHash,
  }
}

/// Parse and verify governance action VAA against current governance and
/// guardians. Returns action and updated governance.
pub fn parse_and_verify_action(
  vaa: PreparedVAA,
  governance: Governance,
  guardians: Guardians,
) -> (GovernanceAction, Governance) {
  let VAA { body, .. } = vaa.parse_and_verify_prepared(vaa, guardians)
  expect (u16.as_int(body.emitter_chain) == governance.emitter_chain)?
  expect (body.emitter_address == governance.emitter_address)?
  let seen_sequence = u64.as_int(body.sequence)
  expect (governance.seen_sequence < seen_sequence)?
  (
    parser.run(governance_action(body.timestamp), body.payload),
    Governance { ..governance, seen_sequence },
  )
}

fn governance_action(timestamp: U32) -> Parser<GovernanceAction> {
  let magic <- parse(parser.bytes(4))
  expect (magic == governance_action_magic)?
  let module <- parse(u8.from_be)
  expect (module == governance_action_module)?
  let action <- parse(u8.from_be)
  let chain <- parse(u16.from_be)
  expect (u16.as_int(chain) == env.chain_id)?
  when u8.as_int(action) is {
    1 -> {
      let key <- parse(parser.bytes(32))
      let expires_at <- parse(u64.from_be)
      UpdateTrustedSigner(
        //TODO: Does expires_at have the correct units?
        TrustedSigner { key, expires_at: u64.as_int(expires_at) },
      )
        |> parser.return
    }
    2 -> {
      let script <- parse(u8.from_be)
      let hash <- parse(parser.bytes(28))
      when u8.as_int(script) is {
        1 -> UpgradeSpendScript(hash)
        2 -> {
          let start = u32.as_int(timestamp) * 1000
          UpgradeWithdrawScript {
            deprecated_validity: interval.between(
              start,
              start + env.withdraw_script_expiration_ms,
            ),
            new_script: hash,
          }
        }
        _ -> fail @"unsupported script upgrade ID"
      }
        |> parser.return
    }
    _ -> fail @"unsupported action ID"
  }
}

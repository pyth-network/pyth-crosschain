use parser.{Parser, parse}
use pyth/update.{TrustedSigner}
use types/u16
use types/u64
use types/u8.{U8}
use env

const governance_action_magic: ByteArray = "PTGM"

const governance_action_module: U8 = u8.from_int(3)

pub type GovernanceAction {
  UpdateTrustedSigner(TrustedSigner)
}

pub fn parse_governance_action(src: ByteArray) -> GovernanceAction {
  parser.run(governance_action(), src)
}

fn governance_action() -> Parser<GovernanceAction> {
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
        TrustedSigner { key, expires_at: u64.as_int(expires_at) },
      )
        |> parser.return
    }
    _ -> fail @"unsupported action ID"
  }
}

use aiken/collection/list
use parser.{Parser, parse}
use types/u16.{U16}
use types/u32
use types/u64
use types/u8.{U8}
use wormhole.{Guardians}
use wormhole/vaa.{PreparedVAA, VAA, VAABody}

// Reference: https://github.com/wormhole-foundation/wormhole/blob/main/whitepapers/0002_governance_messaging.md

// Solana
const emitter_chain: U16 = u16.from_int(1)

// https://github.com/wormhole-foundation/wormhole/blob/e5947bb1bee40e573a022ef37a92e59fec1b1422/sdk/rust/vaas-serde/src/lib.rs#L35
const emitter_address: ByteArray =
  #"0000000000000000000000000000000000000000000000000000000000000004"

// https://github.com/wormhole-foundation/wormhole/blob/main/whitepapers/0002_governance_messaging.md#specified-governance-vaas
const core_module: ByteArray =
  "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0Core"

const guardian_set_upgrade_action = u8.from_int(2)

pub fn parse_and_verify_guardian_set_upgrade(
  vaa: PreparedVAA,
  old: Guardians,
) -> Guardians {
  let VAA { body, .. } = vaa.parse_and_verify_prepared(vaa, old)
  let new =
    parse_action(body)
      |> parse_guardian_set_upgrade(u64.as_int(body.sequence))
  expect (old.seen_sequence < new.seen_sequence)?
  expect (old.set_index + 1 == new.set_index)?
  new
}

fn parse_guardian_set_upgrade(
  action: GovernanceAction,
  seen_sequence: Int,
) -> Guardians {
  expect (action.module == core_module)?
  expect (action.action == guardian_set_upgrade_action)?
  expect (action.chain == u16.zero)?
  parser.run(new_guardian_set(seen_sequence), action.args)
}

fn new_guardian_set(seen_sequence: Int) -> Parser<Guardians> {
  let set_index <- parse(u32.from_be)
  let set_length <- parse(u8.from_be)
  let set <- parse(parser.repeat(parser.bytes(20), u8.as_int(set_length)))

  Guardians { seen_sequence, set_index: u32.as_int(set_index), set }
    |> parser.return
}

type GovernanceAction {
  module: ByteArray,
  action: U8,
  chain: U16,
  args: ByteArray,
}

fn parse_action(body: VAABody) -> GovernanceAction {
  expect (body.emitter_chain == emitter_chain)?
  expect (body.emitter_address == emitter_address)?
  parser.run(governance_action, body.payload)
}

const governance_action: Parser<GovernanceAction> = {
    let module <- parse(parser.bytes(32))
    let action <- parse(u8.from_be)
    let chain <- parse(u16.from_be)
    let args <- parse(parser.rest)

    GovernanceAction { module, action, chain, args } |> parser.return
  }

test can_parse_vaa_governance() {
  let vaa =
    #"01000000030d03d4a37a6ff4361d91714730831e9d49785f61624c8f348a9c6c1d82bc1d98cadc5e936338204445c6250bb4928f3f3e165ad47ca03a5d63111168a2de4576856301049a5df10464ea4e1961589fd30fc18d1970a7a2ffaad617e56a0f7777f25275253af7d10a0f0f2494dc6e99fc80e444ab9ebbbee252ded2d5dcb50cbf7a54bb5a01055f4603b553b9ba9e224f9c55c7bca3da00abb10abd19e0081aecd3b352be061a70f79f5f388ebe5190838ef3cd13a2f22459c9a94206883b739c90b40d5d74640006a8fade3997f650a36e46bceb1f609edff201ab32362266f166c5c7da713f6a19590c20b68ed3f0119cb24813c727560ede086b3d610c2d7a1efa66f655bad90900080f5e495a75ea52241c59d145c616bfac01e57182ad8d784cbcc9862ed3afb60c0983ccbc690553961ffcf115a0c917367daada8e60be2cbb8b8008bac6341a8c010935ab11e0eea28b87a1edc5ccce3f1fac25f75b5f640fe6b0673a7cd74513c9dc01c544216cf364cc9993b09fda612e0cd1ced9c00fb668b872a16a64ebb55d27010ab2bc39617a2396e7defa24cd7c22f42dc31f3c42ffcd9d1472b02df8468a4d0563911e8fb6a4b5b0ce0bd505daa53779b08ff660967b31f246126ed7f6f29a7e000bdb6d3fd7b33bdc9ac3992916eb4aacb97e7e21d19649e7fa28d2dd6e337937e4274516a96c13ac7a8895da9f91948ea3a09c25f44b982c62ce8842b58e20c8a9000d3d1b19c8bb000856b6610b9d28abde6c35cb7705c6ca5db711f7be96d60eed9d72cfa402a6bfe8bf0496dbc7af35796fc768da51a067b95941b3712dce8ae1e7010ec80085033157fd1a5628fc0c56267469a86f0e5a66d7dede1ad4ce74ecc3dff95b60307a39c3bfbeedc915075070da30d0395def9635130584f709b3885e1bdc0010fc480eb9ee715a2d151b23722b48b42581d7f4001fc1696c75425040bfc1ffc5394fe418adb2b64bd3dc692efda4cc408163677dbe233b16bcdabb853a20843301118ee9e115e1a0c981f19d0772b850e666591322da742a9a12cce9f52a5665bd474abdd59c580016bee8aae67fdf39b315be2528d12eec3a652910e03cc4c6fa3801129d0d1e2e429e969918ec163d16a7a5b2c6729aa44af5dccad07d25d19891556a79b574f42d9adbd9e2a9ae5a6b8750331d2fccb328dd94c3bf8791ee1bfe85aa00661e99781981faea00010000000000000000000000000000000000000000000000000000000000000004fd4c6c55ec8dfd342000000000000000000000000000000000000000000000000000000000436f726502000000000004135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d"

  let vaa = vaa.parse_unsafe(vaa)
  let action = parse_action(vaa.body)
  let new_guardians =
    parse_guardian_set_upgrade(action, u64.as_int(vaa.body.sequence))

  new_guardians.set_index == 4 && list.length(new_guardians.set) == 19
}

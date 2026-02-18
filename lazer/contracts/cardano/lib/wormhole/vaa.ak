use aiken/collection/list
use aiken/crypto
use parser.{Parser, parse}
use secp256k1
use types/u16.{U16}
use types/u32.{U32}
use types/u64.{U64}
use types/u8.{U8}
use wormhole.{Guardians}

/// VAA with needed preprocessing done off-chain
pub type PreparedVAA {
  vaa: ByteArray,
  recovered_keys: List<ByteArray>,
}

pub fn parse_and_verify_prepared(self: PreparedVAA, guardians: Guardians) -> VAA {
  let keys = list.map(self.recovered_keys, secp256k1.public_key)
  parse_and_verify(self.vaa, guardians, keys)
}

// Reference: https://wormhole.com/docs/protocol/infrastructure/vaas

pub type VAA {
  header: VAAHeader,
  body: VAABody,
}

pub type VAAHeader {
  version: U8,
  guardian_set_index: U32,
  signatures: List<wormhole.Signature>,
}

pub type VAABody {
  timestamp: U32,
  nonce: U32,
  emitter_chain: U16,
  emitter_address: ByteArray,
  sequence: U64,
  consistency_level: U8,
  payload: ByteArray,
}

pub fn parse_and_verify(
  src: ByteArray,
  guardians: Guardians,
  recovered_keys: List<secp256k1.PublicKey>,
) -> VAA {
  let (header, body_src) = parser.run_partial(vaa_header, src)
  expect (header.guardian_set_index == u32.from_int(guardians.set_index))?

  let hash = crypto.keccak_256(crypto.keccak_256(body_src))
  let signatures = list.zip(header.signatures, recovered_keys)
  expect wormhole.has_quorum(guardians, hash, signatures)?

  let body = parser.run(vaa_body, body_src)
  VAA { header, body }
}

pub fn parse_unsafe(src: ByteArray) -> VAA {
  {
    let header <- parse(vaa_header)
    let body <- parse(vaa_body)

    VAA { header, body } |> parser.return
  }
    |> parser.run(src)
}

const vaa_header: Parser<VAAHeader> = {
    let version <- parse(u8.from_be)
    let guardian_set_index <- parse(u32.from_be)
    let signatures_len <- parse(u8.from_be)
    let signatures <-
      parse(parser.repeat(wormhole.signature, u8.as_int(signatures_len)))

    VAAHeader { version, guardian_set_index, signatures } |> parser.return
  }

const vaa_body: Parser<VAABody> = {
    let timestamp <- parse(u32.from_be)
    let nonce <- parse(u32.from_be)
    let emitter_chain <- parse(u16.from_be)
    let emitter_address <- parse(parser.bytes(32))
    let sequence <- parse(u64.from_be)
    let consistency_level <- parse(u8.from_be)
    let payload <- parse(parser.rest)

    VAABody {
      timestamp,
      nonce,
      emitter_chain,
      emitter_address,
      sequence,
      consistency_level,
      payload,
    }
      |> parser.return
  }

const test_vaa: ByteArray =
  #"01000000030d03d4a37a6ff4361d91714730831e9d49785f61624c8f348a9c6c1d82bc1d98cadc5e936338204445c6250bb4928f3f3e165ad47ca03a5d63111168a2de4576856301049a5df10464ea4e1961589fd30fc18d1970a7a2ffaad617e56a0f7777f25275253af7d10a0f0f2494dc6e99fc80e444ab9ebbbee252ded2d5dcb50cbf7a54bb5a01055f4603b553b9ba9e224f9c55c7bca3da00abb10abd19e0081aecd3b352be061a70f79f5f388ebe5190838ef3cd13a2f22459c9a94206883b739c90b40d5d74640006a8fade3997f650a36e46bceb1f609edff201ab32362266f166c5c7da713f6a19590c20b68ed3f0119cb24813c727560ede086b3d610c2d7a1efa66f655bad90900080f5e495a75ea52241c59d145c616bfac01e57182ad8d784cbcc9862ed3afb60c0983ccbc690553961ffcf115a0c917367daada8e60be2cbb8b8008bac6341a8c010935ab11e0eea28b87a1edc5ccce3f1fac25f75b5f640fe6b0673a7cd74513c9dc01c544216cf364cc9993b09fda612e0cd1ced9c00fb668b872a16a64ebb55d27010ab2bc39617a2396e7defa24cd7c22f42dc31f3c42ffcd9d1472b02df8468a4d0563911e8fb6a4b5b0ce0bd505daa53779b08ff660967b31f246126ed7f6f29a7e000bdb6d3fd7b33bdc9ac3992916eb4aacb97e7e21d19649e7fa28d2dd6e337937e4274516a96c13ac7a8895da9f91948ea3a09c25f44b982c62ce8842b58e20c8a9000d3d1b19c8bb000856b6610b9d28abde6c35cb7705c6ca5db711f7be96d60eed9d72cfa402a6bfe8bf0496dbc7af35796fc768da51a067b95941b3712dce8ae1e7010ec80085033157fd1a5628fc0c56267469a86f0e5a66d7dede1ad4ce74ecc3dff95b60307a39c3bfbeedc915075070da30d0395def9635130584f709b3885e1bdc0010fc480eb9ee715a2d151b23722b48b42581d7f4001fc1696c75425040bfc1ffc5394fe418adb2b64bd3dc692efda4cc408163677dbe233b16bcdabb853a20843301118ee9e115e1a0c981f19d0772b850e666591322da742a9a12cce9f52a5665bd474abdd59c580016bee8aae67fdf39b315be2528d12eec3a652910e03cc4c6fa3801129d0d1e2e429e969918ec163d16a7a5b2c6729aa44af5dccad07d25d19891556a79b574f42d9adbd9e2a9ae5a6b8750331d2fccb328dd94c3bf8791ee1bfe85aa00661e99781981faea00010000000000000000000000000000000000000000000000000000000000000004fd4c6c55ec8dfd342000000000000000000000000000000000000000000000000000000000436f726502000000000004135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d"

const test_recovered_keys =
  [
    #"047fa3e98fcc2621337b217b61408a98facaabd25bad2b158438728ce863c14708cfcda1f3b50a16ca0211199079fb338d479a54546ec3c5f775af23a7d7f4fb24",
    #"040bdcbccc0297c2a4f92a7c39358c42f22a8ed700a78bd05c39c8b61aaf2338e825b6c0d26d1f2a2ae4129cd751201f73d7234c753bd0735212a5288b19748fd2",
    #"04cfd90084be68de514fe14a7c281f492223f045566f859ea5c166d6e60bc650c23940909a8e96c2fbffbd15a598b4e6a5b5aa14c126bf58cc1a9e396fe7771965",
    #"048edf3f9d997357a0e2c916ee090392c3a645ebac4f6cd8f826d3ecc0173b33bf06b7c14e8002fc9a5d01af9824a5cb3778472cd477e0ab378091448bca6f0417",
    #"04d5225476d7849b362226952ffc561bab99832f3f8b99741f6d81bbeaffa8e7f6e54a85e5029a3b510707eaa9684df496e4b1268075ad0328693a30bf1b1e0033",
    #"04d9fa78b5b958bea1929080b8ad96dc555d34b051a27aebf711eb1186b807b0448316d994606ac807121838d6c41a58f308bc6307acdf69491fa4b17282f3e66f",
    #"04cc64af75ec2e2741fb9af9f6191cb9ee187d6d26af4d1e96d7bab47e6ec09be12d3192030dc4bbf54d1da319a7a2acfc7a9dd4c644af6646a4aaa02b1024bbab",
    #"04b5943b6e284682ad2e011d6962d41febf86af2f5fc0c9c8f4b81358ff077f9c96ba0880eaf93541eae94b4fa41dba66dab7fb0201cc9af7c75681e5719b0c95f",
    #"040aa78894d894a15933969f5826347439e2c309f2049277a10066c9197840499498ad19ee3d1b291f932ec0890bbdafcec292c4f02a446670cd0084f997e25e2f",
    #"0400f400e3fe40f64032485aad9240ead45a8e1fc83ec08c96db861c0eca155ac898df8673e778e3ccaae8a0f9e6af415fe40e99b0cbc88d7610e536b6041b07fb",
    #"044881345cbb299fa7c60ab2d16cb7fe7bf8d14675506ef6eb6037038b5b7092ea0a9e4d0b53ba3904edd99f86717d6ba81dffe44eb5b23c6fd22c91ab73c33021",
    #"04ee3d4cc17633afe7e1794fcfd728e0643325e3d130eb1daa39c0c5cb05a200b43876117a182cabdcc3795632aa529473a0c8245f9e4f6e43e54c3f1da28bcb82",
    #"0421f338444e96af31cf44958acf5764844efbddace3b823ed761c340c59ed2685d829818c83eebe8f00f783f1048a53515845536668a9e0c059ade7579a0f4204",
  ]
    |> list.map(secp256k1.public_key)

const test_guardians =
  Guardians {
    set_index: 3,
    set: [
      #"58cc3ae5c097b213ce3c81979e1b9f9570746aa5",
      #"ff6cb952589bde862c25ef4392132fb9d4a42157",
      #"114de8460193bdf3a2fcf81f86a09765f4762fd1",
      #"107a0086b32d7a0977926a205131d8731d39cbeb",
      #"8c82b2fd82faed2711d59af0f2499d16e726f6b2",
      #"11b39756c042441be6d8650b69b54ebe715e2343",
      #"54ce5b4d348fb74b958e8966e2ec3dbd4958a7cd",
      #"15e7caf07c4e3dc8e7c469f92c8cd88fb8005a20",
      #"74a3bf913953d695260d88bc1aa25a4eee363ef0",
      #"000ac0076727b35fbea2dac28fee5ccb0fea768e",
      #"af45ced136b9d9e24903464ae889f5c8a723fc14",
      #"f93124b7c738843cbb89e864c862c38cddcccf95",
      #"d2cc37a4dc036a8d232b48f62cdd4731412f4890",
      #"da798f6896a3331f64b48c12d1d57fd9cbe70811",
      #"71aa1be1d36cafe3867910f99c09e347899c19c3",
      #"8192b6e7387ccd768277c17dab1b7a5027c0b3cf",
      #"178e21ad2e77ae06711549cfbb1f9c7a9d8096e8",
      #"5e1487f35515d02a92753504a8d75471b9f49edb",
      #"6fbebc898f403e4773e95feb15e80c9a99c8348d",
    ],
  }

test can_parse_vaa() {
  let VAA { header, body } =
    parser.run(
      {
        let header <- parse(vaa_header)
        let body <- parse(vaa_body)
        VAA { header, body } |> parser.return
      },
      test_vaa,
    )

  expect header.version == u8.from_int(1)
  expect header.guardian_set_index == u32.from_int(3)
  expect list.length(header.signatures) == 13

  expect u32.as_int(body.timestamp) == 1713281400
  expect body.nonce == u32.from_int(427948778)
  expect body.emitter_chain == u16.from_int(1)
  expect
    body.emitter_address == #"0000000000000000000000000000000000000000000000000000000000000004"
  expect body.sequence == u64.from_int(18252082506122526004)
  expect body.consistency_level == u8.from_int(32)
}

test can_verify_vaa() {
  expect _ = parse_and_verify(test_vaa, test_guardians, test_recovered_keys)
}

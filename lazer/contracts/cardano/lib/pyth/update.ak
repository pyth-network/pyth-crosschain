use aiken/collection/list
use aiken/crypto.{Signature, VerificationKey}
use aiken/interval.{Interval}
use parser.{Parser, parse}
use types/u16

const solana_format_magic_le = #"b9011a82"

pub type TrustedSigners {
  set: List<TrustedSigner>,
}

pub type TrustedSigner {
  key: VerificationKey,
  expires_at: Int,
}

pub fn is_trusted(
  self: TrustedSigners,
  interval: Interval,
  key: VerificationKey,
) {
  list.any(
    self.set,
    fn(trusted) {
      (trusted.key == key)? && interval.includes(
        interval.before(trusted.expires_at),
        interval,
      )?
    },
  )
}

pub type PriceUpdate {
  signature: Signature,
  key: VerificationKey,
  payload: ByteArray,
}

pub fn parse_and_verify(
  signers: TrustedSigners,
  interval: Interval,
  src: ByteArray,
) -> PriceUpdate {
  let update = parse_unsafe(src)
  expect
    crypto.verify_ed25519_signature(
      update.key,
      update.payload,
      update.signature,
    )?
  expect is_trusted(signers, interval, update.key)?
  update
}

fn parse_unsafe(src: ByteArray) -> PriceUpdate {
  parser.run(price_update, src)
}

const price_update: Parser<PriceUpdate> = {
    let magic <- parse(parser.bytes(4))
    expect (magic == solana_format_magic_le)?
    let signature <- parse(parser.bytes(64))
    let key <- parse(parser.bytes(32))
    let size <- parse(u16.from_le)
    let payload <- parse(parser.bytes(u16.as_int(size)))

    PriceUpdate { signature, key, payload } |> parser.return
  }

const test_signers: TrustedSigners =
  TrustedSigners {
    set: [
      TrustedSigner {
        key: #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214",
        expires_at: 1,
      },
    ],
  }

const test_interval: Interval = interval.before(1)

test validate_basic() {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

test validation_fails_with_wrong_signature() fail {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000001"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

test validate_bad_magic() fail {
  let message =
    #"c9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

test validate_bad_length() fail {
  let message = #"c9011a82e5cddee2c1bd364c8c57e1"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

test validate_bad_payload_length_too_short() fail {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f505000000"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

test validate_bad_payload_length_too_long() fail {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f5050000000000"

  expect _ = parse_and_verify(test_signers, test_interval, message)
}

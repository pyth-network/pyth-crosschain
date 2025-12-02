use aiken/collection/list
use aiken/crypto.{VerificationKey}
use aiken/interval.{Interval}
use aiken/primitive/bytearray

const solana_format_magic_le = #"b9011a82"

const magic_len = 4

const signature_len = 64

const pubkey_len = 32

const message_size_len = 2

pub type PriceMessage {
  PriceMessage { signature: ByteArray, pubkey: ByteArray, payload: ByteArray }
}

pub type PythSigningPolicy {
  trusted_signers: List<(VerificationKey, Interval)>,
}

pub type PythTrustedSigner {
  PythTrustedSigner(VerificationKey, Interval)
}

pub fn parse_price_message(msg: ByteArray) -> Option<PriceMessage> {
  let magic_offset = 0
  let signature_offset = magic_offset + magic_len
  let pubkey_offset = signature_offset + signature_len
  let message_size_offset = pubkey_offset + pubkey_len
  let message_offset = message_size_offset + message_size_len

  if bytearray.length(msg) >= message_offset {
    let magic = bytearray.slice(msg, 0, signature_offset - 1)

    let signature = bytearray.slice(msg, signature_offset, pubkey_offset - 1)
    let pubkey = bytearray.slice(msg, pubkey_offset, message_size_offset - 1)
    let message_size =
      bytearray.slice(msg, message_size_offset, message_offset - 1)
    let message_size = bytearray.to_int_little_endian(message_size)
    if magic == solana_format_magic_le && bytearray.length(msg) == message_offset + message_size {
      let payload =
        bytearray.slice(msg, message_offset, message_offset + message_size - 1)

      Some(PriceMessage { signature, pubkey, payload })
    } else {
      None
    }
  } else {
    None
  }
}

pub fn validate_signature(msg: PriceMessage) {
  crypto.verify_ed25519_signature(msg.pubkey, msg.payload, msg.signature)
}

pub fn validate_price_message(
  msg: PriceMessage,
  policy: PythSigningPolicy,
  validity_range: Interval,
) -> Bool {
  and {
    policy.trusted_signers
      |> list.any(
          fn(s) {
            and {
              s.1st == msg.pubkey,
              s.2nd |> interval.includes(validity_range),
            }
          },
        ),
    validate_signature(msg),
  }
}

pub fn validate_raw_price_message(
  msg: ByteArray,
  policy: PythSigningPolicy,
  validity_range: Interval,
) -> Bool {
  when parse_price_message(msg) is {
    None -> False
    Some(price_msg) -> validate_price_message(price_msg, policy, validity_range)
  }
}

test validate_basic() {
  let verification_key =
    #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214"
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  expect Some(message) = parse_price_message(message)
  expect message.pubkey == verification_key
  validate_signature(message)
}

test validation_fails_with_wrong_signature() fail {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000001"

  expect Some(message) = parse_price_message(message)
  validate_signature(message)
}

test validate_bad_magic() {
  let message =
    #"c9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  expect None = parse_price_message(message)
}

test validate_bad_length() {
  let message = #"c9011a82e5cddee2c1bd364c8c57e1"

  expect None = parse_price_message(message)
}

test validate_bad_payload_length_too_short() {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f505000000"

  expect None = parse_price_message(message)
}

test validate_bad_payload_length_too_long() {
  let message =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f5050000000000"

  expect None = parse_price_message(message)
}

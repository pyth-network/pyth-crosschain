use aiken/crypto.{Hash, Keccak_256}
use aiken/primitive/bytearray
use aiken/primitive/int
use parser.{parse}
use types/u8

pub opaque type Signature {
  Signature(ByteArray)
}

pub fn signature(raw: ByteArray) -> Signature {
  when bytearray.length(raw) is {
    // recoverable signature - we remove the recovery bit
    65 -> Signature(bytearray.take(raw, 64))
    64 -> Signature(raw)
    _ -> fail @"unexpected signature length, must be 64 or 65"
  }
}

/// Ethereum-style address - 20-byte suffix of Keccak256 hash of `PublicKey`.
pub type PublicKeyAddress =
  ByteArray

pub opaque type PublicKey {
  PublicKey(ByteArray)
}

pub fn public_key(raw: ByteArray) -> PublicKey {
  let length = bytearray.length(raw)
  let flag = bytearray.at(raw, 0)
  expect or {
      // compressed key with prefix 0x2 or 0x3
      (length == 33)? && (flag == 2 || flag == 3)?,
      // uncompressed key with prefix 0x4
      (length == 65)? && (flag == 4)?,
    }
  PublicKey(raw)
}

pub fn to_address(PublicKey(raw): PublicKey) -> PublicKeyAddress {
  if bytearray.length(raw) == 65 {
    bytearray.drop(raw, 1)
      |> crypto.keccak_256()
      |> bytearray.drop(12)
  } else {
    // supporting compressed keys would be computationally expensive - caller
    // should do it off-chain instead
    fail @"secp256k1.to_address does not support compressed keys"
  }
}

pub fn verify_ecdsa(
  self: PublicKey,
  hash: Hash<Keccak_256, ByteArray>,
  Signature(signature): Signature,
) -> Bool {
  to_compressed(self)
    |> crypto.verify_ecdsa_signature(hash, signature)
}

fn to_compressed(PublicKey(raw): PublicKey) -> ByteArray {
  if bytearray.length(raw) == 33 {
    raw
  } else {
    let (x, y) =
      parser.run(
        {
          let _ <- parse(u8.from_be)
          let x <- parse(parser.bytes(32))
          let y <- parse(parser.bytes(32))
          (x, y) |> parser.return
        },
        raw,
      )
    let flag = 2 + int.from_bytearray_big_endian(y) % 2
    bytearray.push(x, flag)
  }
}

test can_compress_uncompressed() {
  let key =
    public_key(
      #"04011ae2aa4a47942d486b54e4f3a10cfdba87ffd6bcf0e876ccc605ddf514189cc1361ddc2122c139359fe9453dda59e753f86741339553572ef24c63e939e694",
    )
  expect
    to_compressed(key) == #"02011ae2aa4a47942d486b54e4f3a10cfdba87ffd6bcf0e876ccc605ddf514189c"
}

test can_compress_compressed() {
  let key =
    public_key(
      #"02011ae2aa4a47942d486b54e4f3a10cfdba87ffd6bcf0e876ccc605ddf514189c",
    )
  expect PublicKey(to_compressed(key)) == key
}

test converts_to_address() {
  let key =
    public_key(
      #"04297753f291bcff999a52b8cafd8c8d80a1283fc9c7351aa8eb8f799e5c136f113a5b85271f9cef11f8f498687d05413b5a3c93dff60fe26f4fabcc81d6f71b52",
    )
  expect to_address(key) == #"8fd5bd8840161a77cdc92cd990ae10735b662463"
}

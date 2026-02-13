use aiken/crypto.{Hash, Keccak_256}
use aiken/primitive/bytearray
use aiken/primitive/int
use parser.{parse}
use types/u8

pub opaque type Signature {
  Signature(ByteArray)
}

pub fn signature(raw: ByteArray) -> Signature {
  let length = bytearray.length(raw)
  if length == 65 {
    // recoverable signature - we remove the recovery bit
    Signature(bytearray.take(raw, 64))
  } else {
    expect (length == 64)?
    Signature(raw)
  }
}

fn signature_to_bytearray(Signature(self): Signature) -> ByteArray {
  self
}

/// Ethereum-style address - 20-byte suffix of Keccak256 hash of `PublicKey`.
pub type PublicKeyAddress =
  ByteArray

pub opaque type PublicKey {
  PublicKey(ByteArray)
}

fn to_bytearray(PublicKey(self): PublicKey) -> ByteArray {
  self
}

pub fn public_key(raw: ByteArray) -> PublicKey {
  let length = bytearray.length(raw)
  let flag = bytearray.at(raw, 0)
  if length == 33 {
    // compressed key with prefix 0x2 or 0x3
    expect (flag == 2 || flag == 3)?
  } else {
    // uncompressed key with prefix 0x4
    expect (length == 65)?
    expect (flag == 4)?
  }
  PublicKey(raw)
}

pub fn is_uncompressed(PublicKey(self): PublicKey) -> Bool {
  let flag = bytearray.at(self, 0)
  flag == 4
}

pub fn to_address(self: PublicKey) -> PublicKeyAddress {
  // supporting compressed keys would be computationally expensive - caller
  // should do it off-chain instead
  if !is_uncompressed(self) {
    fail @"secp256k1.to_address does not support compressed keys"
  } else {
    let coords = to_bytearray(self) |> bytearray.drop(1)
    let hash = crypto.keccak_256(coords)
    bytearray.drop(hash, 12)
  }
}

pub fn is_compressed(PublicKey(self): PublicKey) -> Bool {
  let flag = bytearray.at(self, 0)
  flag == 2 || flag == 3
}

pub fn to_compressed(self: PublicKey) -> ByteArray {
  let raw = to_bytearray(self)
  if is_compressed(self) {
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

pub fn verify_ecdsa(
  self: PublicKey,
  hash: Hash<Keccak_256, ByteArray>,
  signature: Signature,
) -> Bool {
  to_compressed(self)
    |> crypto.verify_ecdsa_signature(hash, signature_to_bytearray(signature))
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
  expect to_compressed(key) == to_bytearray(key)
}

test converts_to_address() {
  let key =
    public_key(
      #"04297753f291bcff999a52b8cafd8c8d80a1283fc9c7351aa8eb8f799e5c136f113a5b85271f9cef11f8f498687d05413b5a3c93dff60fe26f4fabcc81d6f71b52",
    )
  expect to_address(key) == #"8fd5bd8840161a77cdc92cd990ae10735b662463"
}

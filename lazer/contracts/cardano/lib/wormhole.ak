use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto
use parser.{Parser, parse}
use secp256k1
use types/u8.{U8}

pub type Guardians {
  set_index: Int,
  set: List<secp256k1.PublicKeyAddress>,
}

pub type Signature {
  index: U8,
  signature: crypto.Signature,
}

pub const signature: Parser<Signature> = {
    let index <- parse(u8.from_be)
    let signature <- parse(parser.bytes(65))
    Signature { index, signature } |> parser.return
  }

fn quorum(self: Guardians) {
  list.length(self.set) * 2 / 3 + 1
}

pub fn has_quorum(
  self: Guardians,
  hash: ByteArray,
  signatures: List<(Signature, secp256k1.PublicKey)>,
) -> Bool {
  let recovered =
    list.map(
      signatures,
      fn((Signature { index, signature }, key)) {
        let signature = secp256k1.signature(signature)
        expect secp256k1.verify_ecdsa(key, hash, signature)
        Pair(u8.as_int(index), secp256k1.to_address(key))
      },
    )

  expect_ordered_subset(recovered, self.set)
  list.length(recovered) >= quorum(self)
}

/// Checks that provided pairs of indices and values are an ordered subset of
/// the original list.
fn expect_ordered_subset(self: Pairs<Int, a>, original: List<a>) -> Void {
  expect _ = { let
      index,
      left,
      (seen, unseen),
    <- pairs.foldl(self, (-1, original))
    expect (index > seen)?
    expect [right, ..unseen] = list.drop(unseen, index - 1 - seen)
    expect left == right
    (index, unseen)
  }
}

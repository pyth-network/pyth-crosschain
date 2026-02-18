use aiken/collection/list
use aiken/crypto
use aiken/option
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

  and {
    (not_ordered_subset(recovered, self.set) |> option.is_none())?,
    (list.length(recovered) >= quorum(self))?,
  }
}

/// Checks that provided pairs of indices and values are an ordered subset of
/// the original list. Returns first index that failed or `None` otherwise.
fn not_ordered_subset(self: Pairs<Int, a>, original: List<a>) -> Option<Int> {
  // initial state is to the left of the original list
  not_ordered_subset_(self, -1, original)
}

fn not_ordered_subset_(self, seen, unseen) {
  when self is {
    [] -> None
    [Pair(index, left), ..self] ->
      // check that index is increasing
      if index > seen {
        when list.drop(unseen, index - 1 - seen) is {
          // find matching item in original list
          [right, ..unseen] ->
            if left == right {
              // if matches, advance past seen item
              not_ordered_subset_(self, index, unseen)
            } else {
              Some(index)
            }
          _ -> Some(index)
        }
      } else {
        Some(index)
      }
  }
}

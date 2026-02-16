use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto
use parser.{Parser, parse}
use secp256k1
use types/result.{Err, Ok, Result}
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
    (is_ordered_subset(recovered, self.set) |> result.is_ok())?,
    (list.length(recovered) >= quorum(self))?,
  }
}

/// Checks that provided pairs of indices and values are an ordered subset of
/// the original list. If not, returns first index that failed.
fn is_ordered_subset(
  self: Pairs<Int, a>,
  original: List<a>,
) -> Result<Void, Int> {
  self
    |> pairs.foldl(
        // initial state is to the left of the original list
        Ok((-1, original)),
        fn(index, left, state) {
          let (seen, unseen) <- result.and_then(state)
          // check that index is increasing
          let _ <- result.guard_then(index > seen, index)
          // find matching item in original list
          when list.drop(unseen, index - 1 - seen) is {
            [right, ..unseen] -> {
              let _ <- result.guard_then(left == right, index)
              // if matches, advance past seen item
              Ok((index, unseen))
            }
            _ -> Err(index)
          }
        },
      )
    |> result.void
}

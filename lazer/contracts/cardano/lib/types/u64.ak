use aiken/math
use aiken/primitive/bytearray
use aiken/primitive/int
use parser.{Parser}

pub opaque type U64 {
  U64(Int)
}

pub const zero: U64 = U64(0)

pub const max: Int = math.pow2(64) - 1

pub fn as_int(U64(self): U64) -> Int {
  self
}

pub fn from_int(value: Int) -> U64 {
  expect (value >= 0 && value <= max)?
  U64(value)
}

pub const from_be: Parser<U64> =
  parser.bytes(8)
    |> parser.map(fn(bs) { U64(int.from_bytearray_big_endian(bs)) })

pub fn to_be(self: U64) -> ByteArray {
  bytearray.from_int_big_endian(as_int(self), 8)
}

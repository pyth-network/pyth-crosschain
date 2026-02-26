use aiken/math
use aiken/primitive/bytearray
use aiken/primitive/int
use parser.{Parser}

pub opaque type U32 {
  U32(Int)
}

pub const zero: U32 = U32(0)

pub const max: Int = math.pow2(32) - 1

pub fn as_int(U32(self): U32) -> Int {
  self
}

pub fn from_int(value: Int) -> U32 {
  expect (value <= max)?
  U32(value)
}

pub const from_be: Parser<U32> =
  parser.bytes(4)
    |> parser.map(fn(bs) { U32(int.from_bytearray_big_endian(bs)) })

pub fn to_be(self: U32) -> ByteArray {
  bytearray.from_int_big_endian(as_int(self), 4)
}

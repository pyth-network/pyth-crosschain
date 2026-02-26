use aiken/math
use aiken/primitive/bytearray
use aiken/primitive/int
use parser.{Parser}

pub opaque type U16 {
  U16(Int)
}

pub const zero: U16 = U16(0)

pub const max: Int = math.pow2(16) - 1

pub fn as_int(U16(self): U16) -> Int {
  self
}

pub fn from_int(value: Int) -> U16 {
  expect (value <= max)?
  U16(value)
}

pub const from_be: Parser<U16> =
  parser.bytes(2)
    |> parser.map(fn(bs) { U16(int.from_bytearray_big_endian(bs)) })

pub const from_le: Parser<U16> =
  parser.bytes(2)
    |> parser.map(fn(bs) { U16(int.from_bytearray_little_endian(bs)) })

pub fn to_be(self: U16) -> ByteArray {
  bytearray.from_int_big_endian(as_int(self), 2)
}

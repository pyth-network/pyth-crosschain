use aiken/math
use aiken/primitive/bytearray.{Byte}
use parser.{Parser}

pub opaque type U8 {
  U8(Int)
}

pub const zero: U8 = U8(0)

pub const max: Int = math.pow2(8) - 1

pub fn as_int(U8(self): U8) -> Byte {
  self
}

pub fn from_int(value: Int) -> U8 {
  expect (value >= 0 && value <= max)?
  U8(value)
}

pub const from_be: Parser<U8> =
  fn(bs) { (U8(bytearray.at(bs, 0)), bytearray.drop(bs, 1)) }

pub fn to_be(self: U8) -> ByteArray {
  let U8(value) = self
  bytearray.push(#[], value)
}

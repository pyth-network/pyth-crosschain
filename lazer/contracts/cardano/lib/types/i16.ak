use aiken/math
use aiken/primitive/int
use parser.{Parser}

pub opaque type I16 {
  I16(Int)
}

pub const zero: I16 = I16(0)

const min: Int = math.pow2(15)

pub const from_be: Parser<I16> =
  parser.bytes(2)
    |> parser.map(fn(bs) { I16(int.from_bytearray_big_endian(bs)) })

pub const from_le: Parser<I16> =
  parser.bytes(2)
    |> parser.map(fn(bs) { I16(int.from_bytearray_little_endian(bs)) })

pub fn as_int(I16(self): I16) -> Int {
  if self < min {
    self
  } else {
    self - math.pow2(16)
  }
}

test parses_zero() {
  expect as_int(parser.run(from_be, #"0000")) == 0
}

test parses_one() {
  expect as_int(parser.run(from_be, #"0001")) == 1
}

test parses_max() {
  expect as_int(parser.run(from_be, #"7fff")) == math.pow2(15) - 1
}

test parses_min() {
  let i = parser.run(from_be, #"8000")
  expect as_int(i) == -math.pow2(15)
}

test parses_minus_one() {
  expect as_int(parser.run(from_be, #"ffff")) == -1
}

test parses_minus_two() {
  expect as_int(parser.run(from_be, #"fffe")) == -2
}

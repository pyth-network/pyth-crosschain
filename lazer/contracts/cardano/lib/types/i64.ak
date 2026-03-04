use aiken/math
use aiken/primitive/int
use parser.{Parser}

pub opaque type I64 {
  I64(Int)
}

pub const zero: I64 = I64(0)

const min: Int = math.pow2(63)

pub const from_be: Parser<I64> =
  parser.bytes(8)
    |> parser.map(fn(bs) { I64(int.from_bytearray_big_endian(bs)) })

pub const from_le: Parser<I64> =
  parser.bytes(8)
    |> parser.map(fn(bs) { I64(int.from_bytearray_little_endian(bs)) })

pub fn as_int(I64(self): I64) -> Int {
  if self < min {
    self
  } else {
    self - math.pow2(64)
  }
}

test parses_zero() {
  expect as_int(parser.run(from_be, #"0000000000000000")) == 0
}

test parses_one() {
  expect as_int(parser.run(from_be, #"0000000000000001")) == 1
}

test parses_max() {
  expect as_int(parser.run(from_be, #"7fffffffffffffff")) == math.pow2(63) - 1
}

test parses_min() {
  let i = parser.run(from_be, #"8000000000000000")
  expect as_int(i) == -math.pow2(63)
}

test parses_minus_one() {
  expect as_int(parser.run(from_be, #"ffffffffffffffff")) == -1
}

test parses_minus_two() {
  expect as_int(parser.run(from_be, #"fffffffffffffffe")) == -2
}

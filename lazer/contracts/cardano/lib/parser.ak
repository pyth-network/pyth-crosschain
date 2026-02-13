use aiken/collection/list
use aiken/primitive/bytearray

/// `Parser<a>` is a "stateful" function that modifies source `ByteArray` while
/// producing value of type `a`. Parsers can be constructed with `parse`
/// function, existing parsing combinators and `return` wrapper using
/// backpassing syntax:
///
/// ```
/// use parser.{Parser, parse}
///
/// {
///   let length <- parse(u32.from_be)
///   let items <- parse(parser.repeat(item_parser, u32.as_int(length)))
///   (length, items) |> parser.return
/// }
/// ```
///
/// Use `run` or `run_partial` to execute the final parser over `ByteArray`.
pub type Parser<a> =
  fn(ByteArray) -> (a, ByteArray)

/// Runs supplied parser over source `ByteArray`. Requires parser to consume
/// the whole input.
pub fn run(self: Parser<a>, src: ByteArray) -> a {
  expect (a, #[]) = self(src)
  a
}

/// Runs supplied parser over source `ByteArray`, returning unconsumed input.
pub fn run_partial(self: Parser<a>, src: ByteArray) -> (a, ByteArray) {
  self(src)
}

/// Applies function over result of the supplied `Parser`.
pub fn map(self: Parser<a>, with: fn(a) -> b) -> Parser<b> {
  fn(bs) {
    let (a, bs1) = self(bs)
    (with(a), bs1)
  }
}

/// Creates `Parser` that does not consume any input, returning provided value.
/// Can be used to construct return value of a composite parser.
pub fn return(value: a) -> Parser<a> {
  fn(bs) { (value, bs) }
}

/// Function for chaining multiple parsers together using backpassing syntax.
/// Feeds result of the first parser into the provided function, producing new
/// composite parser. See `Parser` type for example.
pub fn parse(parser: Parser<a>, then: fn(a) -> Parser<b>) -> Parser<b> {
  fn(bs) {
    let (a, bs1) = parser(bs)
    then(a)(bs1)
  }
}

/// Parses remaining input, returning it as `ByteArray`.
pub const rest: Parser<ByteArray> = fn(bs) { (bs, #[]) }

/// Parses exactly the specified amount of bytes as `ByteArray`. For parsing
/// inidividual bytes as `Byte`, use `types/u8.from_be`.
pub fn bytes(count: Int) -> Parser<ByteArray> {
  expect (count >= 0)?
  fn(bs) {
    expect (bytearray.length(bs) >= count)?
    (bytearray.take(bs, count), bytearray.drop(bs, count))
  }
}

/// Repeatedly applies provided parser, `count` times, returning list of
/// parsed results.
pub fn repeat(self: Parser<a>, count: Int) -> Parser<List<a>> {
  expect (count >= 0)?
  repeat_(self, [], count)
}

fn repeat_(self: Parser<a>, prev: List<a>, count: Int) -> Parser<List<a>> {
  when count is {
    0 -> list.reverse(prev) |> return
    _ -> {
      let a <- parse(self)
      repeat_(self, list.push(prev, a), count - 1)
    }
  }
}

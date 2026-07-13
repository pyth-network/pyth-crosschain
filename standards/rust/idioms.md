# Rust idioms

## Avoiding panics

Panics are unrecoverable errors that unwind the current thread. If a panic occurs
in the main thread, the whole program may terminate. If a panic occurs in a task
spawned on an async runtime, that task will terminate.

Panics are dangerous because they can arise from concise code constructions (such
as slice indexing with `a[n]`) and have vast effects on the program. Minimize the
possibility of panics with the help of the relevant `clippy` lints. Handle the
unexpected case properly no matter how unlikely it seems.

**Common sources of panics:**

| Source of panic | Non-panicking alternatives |
| --------------- | -------------------------- |
| `.unwrap()`, `.expect(...)`, `panic!()`, `assert*!()` | `Result`-based handling using `anyhow`: `.context()?`, `.with_context()?`, `bail!()`, `ensure!()`. |
| `unimplemented!()`, `todo!()`, `unreachable!()` | — |
| Indexing out of bounds on slices, strings, `Vec`, `VecDeque`: `&arr[x]`, `&arr[x..y]` | `.get()`, `.get_mut()` |
| Indexing with a range if min > max: `&arr[to..from]` | `.get()`, `.get_mut()` |
| Indexing a `HashMap` or `BTreeMap` on a non-existing key: `&map[key]` | `.get()`, `.get_mut()`, `.entry()` |
| Indexing a non-ASCII string not at char boundaries: `&"😢😢😢"[0..1]` | `.get()`, `.get_mut()` |
| `Vec` methods: `.insert()`, `.remove()`, `.drain()`, `.split_off()` and many more | There are checked alternatives for some but not all of them. |
| Division by zero: `a / b`, `a % b` | `.checked_div()`, `.checked_rem()`, `/ NonZero*` |

Think about the cases that could cause your code to panic. Try to rewrite the code
in a way that avoids a possible panic. Here are some tips to solve `clippy`
warnings and avoid panics:

- **Use `Result` and return the error to the caller.** Use `.context()` or
  `.with_context()` from `anyhow` to add relevant information to the error. Use
  `.ok_or_else()` or `.context()` to convert `Option` to `Result`.

  ⛔ Bad:

  ```rust
  pub fn best_bid(response: &Response) -> String {
      response.bids[0].clone()
  }
  ```

  ✅ Good:

  ```rust
  pub fn best_bid(response: &Response) -> anyhow::Result<String> {
      Ok(response.bids.first().context("expected 1 item in bids, got 0")?.clone())
  }
  ```

- **If propagation with `?` doesn't work because of error type, convert the error
  type with `.map_err()`.**

  ✅ Good (`binary_search` returns `Err(index)` instead of a well-formed error, so
  we create our own error value):

  ```rust
  items
      .binary_search(&needle)
      .map_err(|_| anyhow!("item not found: {:?}", needle))?;
  ```

  ✅ Good (`?` can't convert from `Box<dyn Error>` to `anyhow::Error`, but there is
  a function that converts it):

  ```rust
  let info = message.info().map_err(anyhow::Error::from_boxed)?;
  ```

- **If the error is in a non-`Result` function inside an iterator chain (e.g.
  `.map()`) or a combinator (e.g. `.unwrap_or_else()`), consider rewriting it as a
  plain `for` loop or `match`/`if let` to allow error propagation.** (If you're
  determined to make iterators work, the `fallible-iterator` crate may also be
  useful.)

  ⛔ Bad (unwraps the error just because `?` doesn't work):

  ```rust
  fn check_files(paths: &[&Path]) -> anyhow::Result<()> {
      let good_paths: Vec<&Path> = paths
          .iter()
          .copied()
          .filter(|path| fs::read_to_string(path).unwrap().contains("magic"))
          .collect();
      //...
  }
  ```

  ✅ Good:

  ```rust
  fn check_files(paths: &[&Path]) -> anyhow::Result<()> {
      let mut good_paths = Vec::new();
      for path in paths {
          if fs::read_to_string(path)?.contains("magic") {
              good_paths.push(path);
          }
      }
      //...
  }
  ```

- **Log the error and return early or skip an item.**

  ⛔ Bad (panics if we add too many publishers):

  ```rust
  let publisher_count = u16::try_from(prices.len())
      .expect("too many publishers");
  ```

  ✅ Good:

  ```rust
  let Ok(publisher_count) = u16::try_from(prices.len()) else {
      error!("too many publishers ({})", prices.len());
      return Default::default();
  };
  ```

  ⛔ Bad (terminates on error) (and yes, [it can fail](https://www.greyblake.com/blog/when-serde-json-to-string-fails/)):

  ```rust
  loop {
      //...
      yield Ok(
          serde_json::to_string(&response).expect("should not fail") + "\n"
      );
  }
  ```

  ✅ Good (`return` instead of `continue` could also be reasonable):

  ```rust
  loop {
      //...
      match serde_json::to_string(&response) {
          Ok(json) => {
              yield Ok(json + "\n");
          }
          Err(err) => {
              error!("json serialization error for {:?}: {}", response, err);
              continue;
          }
      }
  }
  ```

- **Supply a sensible default:**

  ⛔ Bad:

  ```rust
  let interval_us: u64 = snapshot_interval
      .as_micros()
      .try_into()
      .expect("snapshot_interval overflow");
  ```

  ✅ Better:

  ```rust
  let interval_us =
      u64::try_from(snapshot_interval.as_micros()).unwrap_or_else(|_| {
          error!(
              "invalid snapshot_interval in config: {:?}, defaulting to 1 min",
              snapshot_interval
          );
          60_000_000 // 1 min
      });
  ```

- **Avoid checking a condition and then unwrapping.** Instead, combine the check
  and access using `match`, `if let`, and combinators such as `map_or`, `some_or`,
  etc.

  🟡 Not recommended:

  ```rust
  if !values.is_empty() {
      process_one(&values[0]);
  }
  ```

  ✅ Good:

  ```rust
  if let Some(first_value) = values.first() {
      process_one(first_value);
  }
  ```

  🟡 Not recommended:

  ```rust
  .filter(|price| {
      median_price.is_none() || price < &median_price.expect("should not fail")
  })
  ```

  ✅ Good:

  ```rust
  .filter(|price| median_price.is_none_or(|median_price| price < &median_price))
  ```

  🟡 Not recommended:

  ```rust
  if data.len() < header_len {
      bail!("data too short");
  }
  let header = &data[..header_len];
  let payload = &data[header_len..];
  ```

  ✅ Good:

  ```rust
  let (header, payload) = data
      .split_at_checked(header_len)
      .context("data too short")?;
  ```

- **Avoid the panic by introducing a constant or moving the panic inside the
  constant initialization.** Panicking in const initializers is safe because it
  happens at compile time.

  🟡 Not recommended:

  ```rust
  price.unwrap_or(Price::new(PRICE_FEED_EPS).expect("should never fail"))
  ```

  ✅ Good:

  ```rust
  #[allow(clippy::unwrap_used, reason = "safe in const")]
  const MIN_POSITIVE_PRICE: Price =
      Price(NonZeroI64::new(PRICE_FEED_EPS).unwrap());
  ```

- **If it's not possible to refactor the code, allow the lint and specify why the
  code cannot fail. Prefer `.expect()` over `.unwrap()` and specify the failure in
  the argument.** This is reasonable if the failure is truly impossible or if a
  failure would be so critical that the service cannot continue working.

  🟡 Not recommended:

  ```rust
  Some(prices[prices.len() / 2])
  ```

  ✅ Good:

  ```rust
  #[allow(
      clippy::indexing_slicing,
      reason = "prices are not empty, prices.len() / 2 < prices.len()"
  )]
  Some(prices[prices.len() / 2])
  ```

  🟡 Not recommended:

  ```rust
  let expiry_time = expiry_times.get(self.active_index).unwrap();
  ```

  ✅ Better:

  ```rust
  #[allow(
      clippy::expect_used,
      reason = "we only assign valid indexes to `self.active_index`"
  )]
  let expiry_time = expiry_times
      .get(self.active_index)
      .expect("invalid active index");
  ```

## Avoid unchecked arithmetic operations

Be aware that some basic arithmetic operators (`+`, `-`, `*`, unary negation with
`-`) and some functions (`.abs()`, `.pow()`, `.next_multiple_of()`, etc.) can
overflow. These operators and functions will panic only in debug mode (more
specifically, when debug assertions are enabled). In release mode, they will
quietly produce an invalid value. For example, `200u8 + 150u8` evaluates to 94 in
release mode. Be especially careful when subtracting unsigned integers because even
small values can produce an overflow: `2u32 - 4u32` evaluates to 4294967294.

Consider using an alternative function that produces a more reasonable value:

- Use `.checked_*()` functions that return `None` in case of overflow.
- Use `.saturating_*()` functions that will cap on MIN or MAX value.

Use `.wrapping_*()` functions if you expect the value to wrap around.

⛔ Bad:

```rust
charge_payment(amount + fee);
```

✅ Good:

```rust
let total = amount
    .checked_add(fee)
    .with_context(|| {
        format!("total amount overflow: amount = {amount}, fee = {fee}")
    })?;
charge_payment(total);
```

> You can catch unchecked arithmetic operations with the
> `clippy::arithmetic_side_effects` lint, but we do not enable this lint (for now).

## Avoid implicit wrapping and truncation with `as`

Limit the use of the `as` keyword for converting values between numeric types.
While `as` is often the most convenient option, it's quite bad at expressing
intent. `as` can do conversions with different semantics. In the case of integers,
it can do both **lossless conversions** (e.g. from `u8` to `u32`; from `u32` to
`i64`) and **lossy conversions** (e.g. `258_u32 as u8` evaluates to 2; `200_u8 as
i8` evaluates to -56).

- Always use `.into()` and `T::from()` instead of `as` for lossless conversions.
  This makes the intent more clear.
- Only use `as` for lossy conversions when you specifically intend to perform a
  lossy conversion and are aware of how it affects the value. Add an `#[allow]`
  attribute and specify the reason.
- See if you can choose a more suitable type to avoid the conversion entirely.
- When a lossless conversion is necessary but not possible using `From` and `Into`,
  use `.try_into()` or `T::try_from()` instead of `as` and handle the error case
  appropriately.
- When correctness of the resulting value is not super important (e.g. it's used
  for metrics) and the failure is unlikely, you can use `.shrink()` or
  `T::shrink_from()` provided by the `truncate-integer` crate. These functions
  perform a saturating conversion, i.e. they return a min or max value when the
  value cannot be represented in the new type. In most cases it's better than what
  `as` would produce.

⛔ Bad (if `count` is negative, it will attempt a huge allocation which can crash
the process):

```rust
let count: i32 = /*...*/;
vec.resize(count as usize);
```

✅ Good:

```rust
vec.resize(
    count
        .try_into()
        .with_context(|| format!("invalid count: {count}"))?
);
```

⛔ Bad (truncates on overflow, producing an invalid value):

```rust
ABC_DURATION.record(started_at.elapsed().as_micros() as u64, &[]);
```

✅ Better (saturates to max value, using the `truncate-integer` crate):

```rust
ABC_DURATION.record(started_at.elapsed().as_micros().shrink(), &[]);
```

## Use newtype IDs instead of raw strings and integers

Identifiers should be their own types, not bare `String`s or integers. A newtype
like `FeedId` makes it impossible to pass a feed id where a publisher id is
expected, documents intent at every call site, and gives you one place to enforce
validation and formatting. This is the same "use types to define behaviour"
principle from the cross-cutting [style guide](../style.md), applied to IDs.

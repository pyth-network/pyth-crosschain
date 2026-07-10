# Rust idioms

## Avoiding panics

Panics are unrecoverable errors that unwind the current thread: one in the main
thread may terminate the whole program, one in a spawned async task terminates
that task. They arise from concise code (e.g. `a[n]`) yet have vast effects, so
minimize them with the relevant `clippy` lints.

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

Techniques to avoid panics:

- **Use `Result` and return the error to the caller.** Add context with
  `.context()` / `.with_context()` from `anyhow`. Convert `Option` to `Result`
  with `.ok_or_else()` or `.context()`.

  ```rust
  // ⛔ Bad:
  pub fn best_bid(response: &Response) -> String {
      response.bids[0].clone()
  }

  // ✅ Good:
  pub fn best_bid(response: &Response) -> anyhow::Result<String> {
      Ok(response.bids.first().context("bids is empty")?.clone())
  }
  ```

- **If `?` doesn't work because of the error type, convert it with `.map_err()`**
  (e.g. `binary_search` returns `Err(index)`, so build your own with `anyhow!`).

- **If an error occurs in a non-`Result` function inside an iterator chain or
  combinator, rewrite it as a `for` loop or `match`/`if let`** to allow error
  propagation. (The `fallible-iterator` crate can also help.)

- **Log the error and return early, skip an item, or supply a sensible default:**

  ```rust
  // ⛔ Bad:
  let interval_us: u64 = snapshot_interval.as_micros().try_into().unwrap();

  // ✅ Good:
  let interval_us = u64::try_from(snapshot_interval.as_micros()).unwrap_or_else(|_| {
      error!("invalid snapshot_interval {:?}, defaulting to 1 min", snapshot_interval);
      60_000_000 // 1 min
  });
  ```

- **Avoid checking a condition and then unwrapping.** Combine the check and access
  using `match`, `if let`, or combinators such as `map_or` and `is_none_or`.

- **Introduce a constant or move the panic into constant initialization** (const
  initializers panic at compile time, so it's safe).

- **If refactoring isn't possible, allow the lint and state why the code cannot
  fail; prefer `.expect()` over `.unwrap()`.** Reasonable only if the failure is
  truly impossible, or so critical that the service cannot continue.

  ```rust
  #[allow(
      clippy::indexing_slicing,
      reason = "prices are not empty, prices.len() / 2 < prices.len()"
  )]
  Some(prices[prices.len() / 2])
  ```

## Avoid unchecked arithmetic operations

Some arithmetic operators (`+`, `-`, `*`, unary `-`) and functions (`.abs()`,
`.pow()`, etc.) can overflow. They panic only in debug mode; in release mode they
quietly produce an invalid value (`200u8 + 150u8` evaluates to 94). Be especially
careful subtracting unsigned integers (`2u32 - 4u32` evaluates to 4294967294).

Prefer an alternative: `.checked_*()` returns `None` on overflow,
`.saturating_*()` caps at MIN/MAX, and `.wrapping_*()` wraps around.

```rust
// ⛔ Bad:
charge_payment(amount + fee);

// ✅ Good:
let total = amount.checked_add(fee).context("amount + fee overflowed")?;
charge_payment(total);
```

> Catch these with the `clippy::arithmetic_side_effects` lint (not enabled yet).

## Avoid implicit wrapping and truncation with `as`

Limit `as` for converting between numeric types. It is convenient but expresses
intent poorly, mixing **lossless conversions** (e.g. `u8` to `u32`) and **lossy
conversions** (`258_u32 as u8` evaluates to 2; `200_u8 as i8` to -56).

- Use `.into()` / `T::from()` for lossless conversions; this makes intent clear.
- Only use `as` for a lossy conversion you specifically intend, with an `#[allow]`
  attribute stating the reason. Better yet, pick a type that avoids it entirely.
- When a lossless conversion is necessary but `From`/`Into` don't apply, use
  `.try_into()` / `T::try_from()` and handle the resulting error.
- When correctness is not critical (e.g. metrics) and failure is unlikely, use
  `.shrink()` / `T::shrink_from()` from `truncate-integer`, which saturates to a
  min or max value when the value doesn't fit — better than `as`.

```rust
// ⛔ Bad (if `count` is negative, it attempts a huge allocation that can crash):
let count: i32 = /*...*/;
vec.resize(count as usize);

// ✅ Good:
vec.resize(count.try_into().with_context(|| format!("invalid count: {count}"))?);
```

## Use newtype IDs instead of raw strings and integers

Identifiers should be their own types, not bare `String`s or integers. A newtype
like `FeedId` makes it impossible to pass a feed id where a publisher id is
expected, documents intent at every call site, and gives you one place to enforce
validation and formatting — the same "use types to define behaviour" principle
from the cross-cutting [style guide](../style.md), applied to IDs.

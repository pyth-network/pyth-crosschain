# Rust testing

The cross-cutting [testing.md](../testing.md) applies — test-driven development is
required, and you never widen an export just to reach it from a test. This page
covers the Rust-specific mechanics.

## The local gate

Before submitting Rust changes, run these and verify they pass:

```sh
cargo fmt --check
cargo clippy --all-targets -- --deny warnings
cargo test --package <affected-package>
```

- `cargo fmt --check` — formatting.
- `cargo clippy --all-targets -- --deny warnings` — linting, including test and
  example targets. `--deny warnings` mirrors CI: any warning is a failure.
- `cargo test --package <affected-package>` — run the tests for the package(s) your
  change touches. Run the full `cargo test --workspace` when your change is
  cross-cutting.

## Keep tests next to the code

Unit tests live in a `#[cfg(test)] mod tests` in the same file as the code under
test, so they can exercise private items without widening any visibility.
Integration tests that drive a crate through its public API live in the crate's
`tests/` directory.

The panic-related clippy lints are relaxed inside tests via `clippy.toml`
(`allow-unwrap-in-tests`, `allow-expect-in-tests`, `allow-panic-in-tests`,
`allow-indexing-slicing-in-tests`), so `.unwrap()`, `.expect()`, and indexing are
fine in test code where a panic simply fails the test.

## Async tests

Use `#[tokio::test]` for tests that need an async runtime:

```rust
#[tokio::test]
async fn resolves_feed() {
    let feed = fetch_feed(id).await.unwrap();
    assert_eq!(feed.id, id);
}
```

- Prefer the default current-thread runtime; only reach for
  `#[tokio::test(flavor = "multi_thread")]` when the test genuinely needs multiple
  worker threads.
- Don't sleep to wait for a condition — await the thing you actually care about, or
  poll it with a bounded timeout so a hang fails fast instead of stalling the suite.

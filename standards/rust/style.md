# Rust style and tooling

## Toolchain

Pin a specific version with a `rust-toolchain` / `rust-toolchain.toml` file (see the
root [`rust-toolchain.toml`](../../rust-toolchain.toml)), preferring stable unless
nightly is required. `Cargo.lock` is checked in and used in CI and for builds; pin
other CI tool versions too.

## Formatting

Use `rustfmt` with default configuration, and `taplo` with default configuration
for `Cargo.toml` files.

## Linting

Use `clippy` with the workspace configuration. The full lint set is the single
source of truth in the root [`Cargo.toml`](../../Cargo.toml) under
`[workspace.lints]`, with tests-only relaxations in
[`clippy.toml`](../../clippy.toml). It denies `unsafe_code` and
`wildcard_dependencies` and warns on three groups: panic sources (`unwrap_used`,
`expect_used`, `indexing_slicing`, `panic`, `todo`, `unreachable`, …), numeric-cast
correctness (`cast_lossless`, `cast_possible_truncation`, `cast_possible_wrap`,
`cast_sign_loss`), and other correctness lints (`match_wild_err_arm`, `unused_self`,
`used_underscore_binding`, …). `allow_attributes_without_reason` is a warning, so
every `#[allow]` must carry a `reason`.

See [idioms.md](idioms.md) and [errors-and-logging.md](errors-and-logging.md) for
help with these lints, and the
[Clippy lints documentation](https://rust-lang.github.io/rust-clippy/master/index.html)
for details on each.

For a false positive, put `#[allow(lint_name, reason = "...")]` on the relevant line
or block explaining why the code is correct. Many lints (e.g. panic-related ones) are
allowed globally for tests via `clippy.toml`.

## Essential crates

Prefer these over alternatives:

- `tracing` for logging/tracing, `opentelemetry` for metrics
- `anyhow` (services) and `thiserror` (libraries) for error handling
- `backoff` for retrying (mind transient vs. permanent errors)
- `axum` and `utoipa` for API servers, `reqwest` for HTTP client
- `chrono` for date and time, `humantime` for parsing/printing durations
- `config` for config loading, `tokio` for async runtime
- `itertools` for iterators, `derive_more` and `strum` for more derives
- `proptest`, `mry` for testing, `criterion` for benchmarking

## Other recommendations

- Avoid unsafe code; it is hard to get right and only needed for low-level work
  (`unsafe_code = "deny"` enforces this).
- Prefer default requirements (e.g. `time = "0.1.12"`) to allow semver-compatible
  upgrades. Avoid `<=` requirements and never use `*`.
- Avoid macros when the same result is achievable without one.

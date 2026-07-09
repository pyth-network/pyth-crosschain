# Rust style and tooling

## Toolchain

Always pin a specific version using a `rust-toolchain` / `rust-toolchain.toml`
file. Use stable versions unless nightly is absolutely required. Periodically
update the pinned version when possible. This repo pins its toolchain in the root
[`rust-toolchain.toml`](../../rust-toolchain.toml).

`Cargo.lock` is checked in to git and used in CI and for building
packages/binaries. Versions of other tools used in CI should be pinned too.

## Formatting

Use `rustfmt` with default configuration. Use `taplo` with default configuration
for `Cargo.toml` files.

## Linting

Use `clippy` with the workspace configuration. The lint set is defined once in the
root [`Cargo.toml`](../../Cargo.toml) under `[workspace.lints]`, and the
tests-only relaxations live in [`clippy.toml`](../../clippy.toml). The configured
lints are:

```toml
[lints.rust]
unsafe_code = "deny"

[lints.clippy]
wildcard_dependencies = "deny"

collapsible_if = "allow"
collapsible_else_if = "allow"

allow_attributes_without_reason = "warn"

# Panics
expect_used = "warn"
fallible_impl_from = "warn"
indexing_slicing = "warn"
panic = "warn"
panic_in_result_fn = "warn"
string_slice = "warn"
todo = "warn"
unchecked_duration_subtraction = "warn"
unreachable = "warn"
unwrap_in_result = "warn"
unwrap_used = "warn"

# Correctness
cast_lossless = "warn"
cast_possible_truncation = "warn"
cast_possible_wrap = "warn"
cast_sign_loss = "warn"
collection_is_never_read = "warn"
match_wild_err_arm = "warn"
path_buf_push_overwrite = "warn"
read_zero_byte_vec = "warn"
same_name_method = "warn"
suspicious_operation_groupings = "warn"
suspicious_xor_used_as_pow = "warn"
unused_self = "warn"
used_underscore_binding = "warn"
while_float = "warn"
```

The recommendations in [idioms.md](idioms.md) and
[errors-and-logging.md](errors-and-logging.md) should help with dealing with these
lints. Refer also to the [Clippy lints documentation](https://rust-lang.github.io/rust-clippy/master/index.html)
for more information about each lint.

If a lint is a false positive, put `#[allow(lint_name, reason = "...")]` on the
relevant line or block and specify why the code is correct. Many of the lints
(e.g. most of the panic-related lints) can be allowed globally for tests and other
non-production code — this repo does so via `clippy.toml`.

## Essential crates

Prefer these crates over introducing alternatives:

- `tracing` for logging and tracing
- `opentelemetry` for metrics
- `anyhow` for error handling in services
- `thiserror` for error handling in libraries
- `backoff` for retrying (take note of the distinction between transient and
  permanent errors)
- `axum` and `utoipa` for API server implementation
- `reqwest` for HTTP client
- `chrono` for date and time manipulation
- `config` for flexible config loading
- `humantime` for printing and parsing duration
- `tokio` for async runtime
- `itertools` for extra operations on iterators
- `derive_more` and `strum` for more derives
- `proptest`, `mry` for testing
- `criterion` for benchmarking

## Other recommendations

- Avoid writing unsafe code. Unsafe code is hard to get right and is only needed
  for really low-level stuff (`unsafe_code = "deny"` enforces this).
- Prefer default requirements (e.g. `time = "0.1.12"`) when specifying dependencies
  to allow semver-compatible upgrades. Avoid `<=` requirements because they break
  semver. Never use the `*` requirement.
- Avoid using macros if the same result can be achieved without a macro.

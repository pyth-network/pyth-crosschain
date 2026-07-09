# Rust standards

Standards for Rust code in the Pyth Crosschain monorepo. The cross-cutting
[style.md](../style.md), [testing.md](../testing.md), and [services.md](../services.md)
also apply.

- [style.md](style.md) — toolchain pinning, formatting (`rustfmt`, `taplo`), the
  clippy configuration, and the essential crates we standardize on.
- [idioms.md](idioms.md) — avoiding panics, checked/saturating arithmetic, numeric
  conversions without `as`, and newtype IDs.
- [errors-and-logging.md](errors-and-logging.md) — `anyhow` for services vs
  `thiserror` for libraries, preserving error sources, and structured logging with
  `tracing`.
- [testing.md](testing.md) — the `cargo fmt` / `cargo clippy` / `cargo test` gate
  and `#[tokio::test]` conventions.

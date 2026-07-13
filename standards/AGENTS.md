# Standards

Code-writing standards for the Pyth Crosschain monorepo, for humans and agents.
**Start here.** Read the cross-cutting files first, then the cluster that matches
the language you are working in.

## Cross-cutting

- [style.md](style.md) — readability, types, layered architecture, locality of
  types and functions, no catch-all modules, self-contained comments.
- [testing.md](testing.md) — test-driven development, and why you should never
  widen an export just to reach it from a test.
- [services.md](services.md) — writing resilient services: error recovery,
  benchmarking, logging/metrics/tracing, dependency minimization, running
  multiple instances.
- [review.md](review.md) — the code-review checklist reviewers apply to every PR
  (also surfaced at the repo root as [REVIEW.md](../REVIEW.md)).

## Rust

- [rust/AGENTS.md](rust/AGENTS.md) — index for the Rust cluster.
- [rust/style.md](rust/style.md) — toolchain, formatting, clippy configuration,
  essential crates.
- [rust/idioms.md](rust/idioms.md) — panic discipline, checked/saturating
  arithmetic, numeric conversions, newtype IDs.
- [rust/errors-and-logging.md](rust/errors-and-logging.md) — `anyhow` vs
  `thiserror`, preserving error sources, structured logging with `tracing`.
- [rust/testing.md](rust/testing.md) — the local test gate and `#[tokio::test]`
  conventions.

## TypeScript

- [typescript/AGENTS.md](typescript/AGENTS.md) — index for the TypeScript cluster.
- [typescript/style.md](typescript/style.md) — Biome, `catalog:` dependency
  versions, layered architecture.
- [typescript/packages.md](typescript/packages.md) — creating a new package with
  `pnpm create-pyth-package`, and package best practices.
- [typescript/testing.md](typescript/testing.md) — test-driven development for
  TypeScript.

# AGENTS.md

Pyth Crosschain is a monorepo for the components that make up the Pyth protocols.
The primary languages are **Rust** (Hermes, Fortuna, Argus, on-chain SDKs, and
other services) and **TypeScript** (SDKs, web apps, tooling).

## Standards

Read [`standards/AGENTS.md`](standards/AGENTS.md) before writing code — it is the
primary entry point for how we write code here. It indexes the cross-cutting style,
testing, services, and review standards, plus the Rust and TypeScript clusters.

## TypeScript apps and UI

Before writing a utility or a component in a TypeScript app or web UI
(`apps/insights`, `apps/developer-hub`, `apps/entropy-explorer`,
`governance/xc_admin/packages/xc_admin_frontend`, …), check what
[`packages/shared-lib`](packages/shared-lib) and
[`packages/component-library`](packages/component-library) already export, and
prefer reusing those over reimplementing them. Neither package has a root
barrel: the `exports` map in each `package.json` is the authoritative list of
importable subpaths, and each subpath resolves to a barrel under `src/` — e.g.
[`shared-lib/src/util/index.ts`](packages/shared-lib/src/util/index.ts) and
[`component-library/src/Button/index.tsx`](packages/component-library/src/Button/index.tsx).

## Tooling

- Tool versions are pinned in [`.tool-versions`](.tool-versions) (Node, pnpm, Rust,
  Python) and [`rust-toolchain.toml`](rust-toolchain.toml). If you use
  [`mise`](https://mise.jdx.dev/), it will pick these up automatically.
- **TypeScript**: `pnpm install`, then [Turborepo](https://turbo.build/) tasks such
  as `pnpm turbo build` / `pnpm turbo test`. `pnpm turbo fix` formats and lints
  (Biome).
- **Rust**: `cargo build`, `cargo test`, `cargo fmt`,
  `cargo clippy --all-targets -- --deny warnings`.
- **pre-commit**: hooks are enforced in CI. Run them locally with
  `pre-commit run --from-ref origin/main --to-ref HEAD`.

## Pull requests

Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages
and PR titles, and bump package versions per [SemVer](https://semver.org/) when
changing a published package.

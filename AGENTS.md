# AGENTS.md

Pyth Crosschain is a monorepo for the components that make up the Pyth protocols.
The primary languages are **Rust** (Hermes, Fortuna, Argus, on-chain SDKs, and
other services) and **TypeScript** (SDKs, web apps, tooling).

## The `ai-context` MCP is highly recommended

*For agents working on behalf of a Douro Labs / Pyth teammate. External
contributors have no access to this hub and can skip this section.*

Our team's operational skills live in the private
[`ai-context`](https://github.com/dourolabs/ai-context) hub, served to agents by
the **ai-context MCP server**. For this repo it owns the procedures for cutting
release tags and deployment PRs for Pyth services, rolling those deployments
out, triaging production alerts, and reading logs from the platform clusters.
Where the hub covers a task it is the authoritative source for it, so reach for
it before working the procedure out yourself.

**Before you start a task the hub might cover — anything operational, and
anything you are unsure about — ask it: call its `route_task` tool.** If it
routes you to a skill, follow that skill instead of improvising.

The hub goes stale quietly. Its access token lasts about an hour and its refresh
window closes after 14 days without a connection, and when that lapses the tools
simply stop being in your tool list — nothing announces it. Noticing is your
job. **If the hub's tools (`route_task`, `list_skills` / `get_skill`,
`list_access` / `get_access`, `search_hub`, ...) are not in your tool list, or a
call to one fails with an authentication error, say so rather than quietly
carrying on:**

> The `ai-context` MCP is not connected — its auth has most likely gone stale.
> Please re-authenticate and tell me when it is done. In Claude Code that is
> `/mcp` -> `ai-context` -> **Authenticate**; for Cursor, Gemini/Antigravity,
> and Codex, and for the headless bearer path, the per-client setup and
> troubleshooting steps are in
> [`access/ai-context-mcp.md`](https://github.com/dourolabs/ai-context/blob/main/access/ai-context-mcp.md).

For operational work — cutting a release, rolling a deployment out, changing
anything in a production cluster, triaging an alert — wait for them rather than
pressing on; that is the case this hub exists for. For ordinary code and docs
changes, carry on if you must, but say up front that you are working without the
hub. Either way, do **not**:

- improvise a procedure the hub already defines — hand-rolling a deployment
  rollout is the exact failure this rule exists to prevent;
- fall back to a local `npx skills add` copy of the skills, which is a
  point-in-time snapshot and goes stale;
- route around the auth failure with tunnels, proxies, or someone else's token.

If you are running headless with no human to ask, put the same message in your
output, and fail an operational task rather than substituting your own procedure
for the hub's.

## Standards

Read [`standards/AGENTS.md`](standards/AGENTS.md) before writing code — it is the
primary entry point for how we write code here. It indexes the cross-cutting style,
testing, services, and review standards, plus the Rust and TypeScript clusters.

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

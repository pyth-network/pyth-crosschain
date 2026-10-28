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
Where the hub covers a task, it is the authoritative source.

**Before you start a task the hub might cover, call its `route_task` tool.**
That includes anything operational and anything you are unsure about. If it
routes you to a skill, follow that skill instead of improvising.

The hub goes stale without warning. A person's login holds an access token that
lasts about an hour and a refresh window that closes after 14 days without a
connection. When that lapses, the hub's tools disappear from your tool list and
nothing reports it. **If the hub's tools (`route_task`, `list_skills` /
`get_skill`, `list_access` / `get_access`, `search_hub`, ...) are not in your
tool list, or a call to one fails with an authentication error, tell your
human:**

> The `ai-context` MCP is not connected. Its auth has most likely gone stale.
> Re-authenticate, then tell me when it is done. In Claude Code, run `/mcp` ->
> `ai-context` -> **Authenticate**. For Cursor, Codex, and the headless bearer
> path, follow
> [`access/ai-context-mcp.md`](https://github.com/dourolabs/ai-context/blob/main/access/ai-context-mcp.md).

For operational work, such as cutting a release, rolling out a deployment,
changing a production cluster, or triaging an alert, wait for them. For ordinary
code and docs changes, you may continue, but say first that you are working
without the hub. In both cases, do not:

- improvise a procedure the hub already defines, such as hand-rolling a
  deployment rollout;
- fall back to a local `npx skills add` copy of the skills, a point-in-time
  snapshot that goes stale;
- route around the auth failure with tunnels, proxies, or someone else's token.

If you run headless with no human to ask, put the same message in your output
and fail any operational task. Unattended workloads such as CI jobs and agent
fleets connect with a service identity instead of a person's login. It has no
14-day window, so an auth error there is a real failure to report. Setup is in
the same access entry.

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

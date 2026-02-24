# Pyth Pro MCP Server

## Project Plan
The full architecture and implementation plan is at `docs/PLAN.md`. Read it before
making any changes.

## Key Commands
- `pnpm --filter @pythnetwork/mcp build` — Build the project
- `pnpm --filter @pythnetwork/mcp test:unit` — Run tests
- `pnpm --filter @pythnetwork/mcp start:dev` — Start in stdio dev mode

## Conventions
- TypeScript, strict mode
- Zod for all input validation
- pino logger to stderr (never console.log)
- snake_case for tool names
- All tools are read-only

## Dependency Notes
- `zod` is pinned to `^3.25.0` instead of using `catalog:` (which resolves to `^3.24.2`).
  `@modelcontextprotocol/sdk` requires `zod >= 3.25` for the `zod/v3` subpath export it uses at runtime.
  Using the catalog version breaks the MCP SDK with `Cannot find module 'zod/v3'`.

# MCP Server — TODO

## Replace hardcoded ASSET_TYPES with `/assets` API
- **PR comment:** https://github.com/pyth-network/pyth-crosschain/pull/3504#discussion_r2856116668
- **Context:** @fhqvst and @azellers are adding an `/assets` API to fetch the canonical asset list. Once available, replace the hardcoded `ASSET_TYPES` array in `src/constants.ts` with a call to that endpoint.

## Extract API clients into the official Lazer TypeScript SDK
- **PR comment:** https://github.com/pyth-network/pyth-crosschain/pull/3504#discussion_r2856151817
- **Context:** The `HistoryClient` and `RouterClient` in `src/clients/` should be extracted into the official Lazer TypeScript SDK after API unification is complete. The MCP server should then depend on that SDK instead of maintaining its own HTTP clients.

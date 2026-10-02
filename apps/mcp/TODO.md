# MCP Server — TODO

## Replace hardcoded ASSET_TYPES with `/assets` API
- **PR comment:** https://github.com/pyth-network/pyth-crosschain/pull/3504#discussion_r2856116668
- **Context:** @fhqvst and @azellers are adding an `/assets` API to fetch the canonical asset list. Once available, replace the hardcoded `ASSET_TYPES` array in `src/constants.ts` with a call to that endpoint.
- **Current state (2026-10):** `ASSET_TYPES` mirrors the History API's `AssetTypeFilter` enum plus `crypto-index` and `crypto-redemption-rate`, which appear in `/v1/symbols` data but are rejected as a server-side filter. Filtering happens client-side over the cached catalog. `INSTRUMENT_TYPES` and `CHANNELS` are hardcoded the same way.

## Extract API clients into the official Lazer TypeScript SDK
- **PR comment:** https://github.com/pyth-network/pyth-crosschain/pull/3504#discussion_r2856151817
- **Context:** The `HistoryClient` and `RouterClient` in `src/clients/` should be extracted into the official Lazer TypeScript SDK after API unification is complete. The MCP server should then depend on that SDK instead of maintaining its own HTTP clients.
- **Blocker (2026-10):** SDK v7's `PythLazerClient.create()` always opens a WebSocket pool, so the MCP server dropped the SDK and calls `POST /v1/latest_price` with `fetch`. Re-adopting it needs a REST-only client (or lazy WebSocket pool) in the SDK, plus `entitled_only` and `/price/range` support.

## Preserve precision for raw integers above 2^53
- **Context:** Raw values are converted with `Number()`. Funding-rate feeds can exceed `Number.MAX_SAFE_INTEGER` (e.g. `FundingRate.Binance.BTC/USDT` price `85297500000000000`), so the last digits of the raw integer can be off. `display_*` values are unaffected. Fixing it means returning raw fields as strings, which changes the output shape.

# Implementation Status: llm.txt Tiered + Protocol Improvements

**Date:** 2026-02-11
**Branch:** `feat/llm-txt-improvements` (created from main, no commits yet)
**Plan:** `docs/plans/2026-02-11-feat-llm-txt-tiered-protocol-improvements-plan.md`
**Brainstorm:** `docs/brainstorms/2026-02-11-llm-txt-improvements-brainstorm.md`

## Completed

### Phase 1: Foundation

- [x] **Task 1.1: Token counting script** — `scripts/count-llm-tokens.ts` created and tested
  - Uses `js-tiktoken` with `getEncoding("cl100k_base")`
  - Extracts content from route files via regex on template literals
  - Outputs to `src/data/llm-token-counts.json`
  - Run via `pnpm count:llm-tokens`

- [x] **Task 1.2: Tier 2 template** — Documented in the plan file

### Phase 2: Tier 2 Content Restructure

- [x] **Task 2.1: Restructure `/llms-price-feeds-core.txt`** — 2,473 tokens (was 1,066)
  - Renamed `STATIC_HEADER` to `CONTENT`, removed `getLLMTextByPaths` import and call
  - Added: Key Concepts (pull model, price structure, confidence, staleness, fees)
  - Added: Streaming SSE example, multi-feed batch pattern
  - Added: Common Patterns (stale price handling, confidence intervals, batch updates, delayed settlement)
  - Added: Troubleshooting (StalePrice, PriceFeedNotFound, InsufficientFee, Anchor version mismatch)
  - Added: 13 Deep Dive Pages with `.mdx` URLs and descriptions
  - Improved: Solidity example uses `getPriceNoOlderThan()` (best practice) instead of `getPrice()`

- [x] **Task 2.2: Restructure `/llms-price-feeds-pro.txt`** — 2,261 tokens (was 403)
  - **Fixed SDK name**: `@pythnetwork/pyth-lazer-sdk` / `PythLazerClient` (was incorrectly `pyth-pro-client`)
  - **Fixed endpoints**: `wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream`
  - Added: Channel types (`real_time`, `fixed_rate@200ms`, `@50ms`, `@1ms`, `@1000ms`)
  - Added: Access token requirements, binary formats, numeric feed IDs
  - Added: On-chain verification (EVM Solidity), response message structure
  - Added: API services table (WebSocket, REST, History), endpoint details
  - Added: Contract addresses (EVM, Solana, Fogo)
  - Added: Common Patterns (redundancy, selective properties, market session filtering)
  - Added: Troubleshooting (client too slow, 403, stale prices, duplicate messages)
  - Added: 15 Deep Dive Pages with `.mdx` URLs

- [x] **Task 2.3: Restructure `/llms-entropy.txt`** — 1,962 tokens (was 574)
  - **Updated to v2 API**: `IEntropyV2`, `requestV2()`, `getFeeV2()` (was v1: `IEntropy`, `requestWithCallback`)
  - Added: All four `requestV2()` overloads with use cases table
  - Added: Gas limit guidelines (50k-500k+ by complexity)
  - Added: Default provider addresses (mainnet + testnet)
  - Added: Random result transformation (range mapping, multiple values from one random)
  - Added: Common Patterns (dynamic fee handling, custom gas, request tracking with sequence numbers)
  - Added: Troubleshooting (callback never fires checklist, Entropy Explorer, re-requesting, error codes)
  - Added: 12 Deep Dive Pages with `.mdx` URLs

- [x] **Task 2.4: Restructure `/llms-price-feeds.txt`** — 705 tokens (was 972)
  - Converted to routing page (no longer duplicates Core/Pro content)
  - Added: Decision matrix table (use case, latency, access, delivery, chains)
  - Added: Brief overviews of both Core and Pro with SDK references
  - Added: Links to individual product files and SKILL.md
  - Removed: Duplicated code examples and contract addresses

### Phase 3: Tier 1 Restructure

- [x] **Task 3.1: Rewrite `/llms.txt`** — 518 tokens (was 464)
  - Enriched product descriptions with SDK references and chain lists
  - Added: Individual page access pattern (`.mdx` extension example)
  - Added: Machine-readable metadata reference (`/llms-manifest.json`)
  - Fixed: Express Relay now links to `.mdx` (was linking to HTML page)
  - Improved: Agent instructions are more specific (4-step numbered list)
  - Changed: Moved `CONTENT` to module-level constant (consistent with other files)

### Phase 4: Protocol Layer

- [x] **Task 4.1: Create `/llms-manifest.json` endpoint** — `src/app/llms-manifest.json/route.ts` (new)
  - Imports token counts from `src/data/llm-token-counts.json`
  - Serves manifest with file metadata, topics, token counts, content hashes
  - Includes `page_access` section for `.mdx` URL pattern
  - `llms-full.txt` excluded (deprecated)
  - All 6 Tier 1/2 files listed with topics for search/routing

- [x] **Task 4.2: Add `sitemap.xml` generation** — `src/app/sitemap.ts` (new)
  - Uses fumadocs `source.getPages()` for all documentation pages
  - Includes all LLM endpoints and SKILL.md
  - Change frequencies set appropriately (monthly for Tier 1, weekly for Tier 2)

- [x] **Task 4.3: Update `/llms-full.txt` deprecation notice**
  - Now references both `/llms.txt` and `/llms-manifest.json`
  - Explains tiered system for efficient agent context loading
  - Keeps Quick Routing links for backwards compatibility
  - 177 tokens (was 143)

### Phase 5: GitHub Action Fix

- [x] **Task 5.1: Fix immediate failures** — `.github/workflows/update-llms-txt.yml`
  - Added: pnpm + Node.js 24 setup steps with dependency installation
  - Updated: `KNOWN_DIRS` now includes `express-relay`, `oracle-integrity-staking`, `metrics`, `pyth-token`
  - Added: Error handling for GPT-4o API (HTTP errors, invalid JSON, missing response)
  - Errors now warn and skip (non-blocking) instead of failing the workflow

- [x] **Task 5.2: Adapt to curated architecture**
  - Renamed all `STATIC_HEADER` references to `CONTENT`
  - Python replacement script auto-detects `const CONTENT` vs `const content` (for SKILL.md)
  - SKILL.md included in review scope when key pages change
  - System prompt updated for fully curated file architecture
  - PR comments updated to reflect curated content model
  - Step names updated (no more "static header" references)

### Phase 6: Cleanup and Validation

- [x] **Task 6.1: Update SKILL.md** — 2,882 tokens (was 2,836)
  - Updated Entropy quick-start from v1 to v2: `IEntropyV2`, `requestV2()`, `getFeeV2()`
  - Updated default stack decision #4 for v2 API
  - Added manifest reference to progressive disclosure section
  - Added tiered system awareness note
  - Fixed Biome key sorting in return statement

- [x] **Task 6.2: Add error handling to Tier 3 route**
  - `src/app/mdx/[...slug]/route.ts` now wraps `getLLMText()` in try-catch
  - Returns 500 with plain text on error instead of crashing
  - Fixed Biome key sorting

- [x] **Task 6.3-6.4: Build, lint, and type-check** — All passing
  - `pnpm count:llm-tokens` — All files within token budgets
  - `pnpm turbo run build` — 39 tasks successful
  - `pnpm turbo run test:lint` — Passed
  - `pnpm turbo run test:types` — `tsc` passed with no errors

### Final Token Count Summary

| File | Before | After | Budget | Status |
|------|--------|-------|--------|--------|
| `/llms.txt` | 464 | 518 | 2k | Done |
| `/llms-price-feeds-core.txt` | 1,066 | 2,473 | 10k | Done |
| `/llms-price-feeds-pro.txt` | 403 | 2,261 | 10k | Done |
| `/llms-price-feeds.txt` | 972 | 705 | 3k | Done |
| `/llms-entropy.txt` | 574 | 1,962 | 10k | Done |
| `/llms-full.txt` | 143 | 177 | — | Deprecated |
| `/SKILL.md` | 2,836 | 2,882 | — | Updated |

## Not Yet Committed

All files created/modified locally on `feat/llm-txt-improvements` but **not committed to git**:

### New files
- `scripts/count-llm-tokens.ts`
- `src/data/llm-token-counts.json` (generated)
- `src/app/llms-manifest.json/route.ts`
- `src/app/sitemap.ts`
- `docs/plans/2026-02-11-feat-llm-txt-tiered-protocol-improvements-plan.md`
- `docs/brainstorms/2026-02-11-llm-txt-improvements-brainstorm.md`
- `docs/plans/2026-02-11-implementation-status.md`

### Modified files
- `src/app/llms.txt/route.ts` — Rich product summaries, manifest reference, .mdx pattern
- `src/app/llms-price-feeds-core.txt/route.ts` — Fully curated, no `getLLMTextByPaths`
- `src/app/llms-price-feeds-pro.txt/route.ts` — Fully curated, SDK name fixed
- `src/app/llms-entropy.txt/route.ts` — Fully curated, v2 API
- `src/app/llms-price-feeds.txt/route.ts` — Routing page
- `src/app/llms-full.txt/route.ts` — Enhanced deprecation notice with manifest
- `src/app/SKILL.md/route.ts` — Entropy v2, manifest link, Biome fixes
- `src/app/mdx/[...slug]/route.ts` — Error handling, Biome fixes
- `.github/workflows/update-llms-txt.yml` — Node setup, curated architecture, SKILL.md scope

## Key Research Findings (for content curation)

### SDK Package Names (resolved)
| Product | Package | Import |
|---------|---------|--------|
| Core (Solidity) | `@pythnetwork/pyth-sdk-solidity` | `IPyth`, `PythStructs` |
| Core (TypeScript) | `@pythnetwork/hermes-client` | `HermesClient` |
| Pro (TypeScript) | `@pythnetwork/pyth-lazer-sdk` | `PythLazerClient` |
| Pro (Solidity) | via git submodule | `PythLazer` |
| Entropy (Solidity) | `@pythnetwork/entropy-sdk-solidity` | `IEntropyV2`, `IEntropyConsumer` |

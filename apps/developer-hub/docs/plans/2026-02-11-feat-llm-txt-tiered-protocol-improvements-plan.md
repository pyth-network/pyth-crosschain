---
title: "feat: Improve llm.txt with tiered content and protocol metadata"
type: feat
date: 2026-02-11
---

# feat: Improve llm.txt with Tiered Content and Protocol Metadata

## Overview

Restructure the Developer Hub's llm.txt system from verbose MDX dumps into a curated 3-tier content hierarchy, add a machine-readable manifest for programmatic discovery, and fix the broken GitHub Action that keeps content fresh.

The current system serves product files that concatenate every MDX page (~50k+ tokens) when agents typically need ~5k tokens of curated context. This wastes agent context windows, slows responses, and includes irrelevant content.

## Problem Statement

1. **Tier 2 files are too large** — Product files like `/llms-price-feeds-core.txt` contain a curated static header (~100 lines) followed by a dynamic dump of every MDX page matching the product path via `getLLMTextByPaths()`. This produces massive files.
2. **Poor structure** — Dynamic MDX dumps lack consistent organization. Agents cannot skip irrelevant sections.
3. **Missing context** — Static headers have good quick-starts but lack common integration patterns, troubleshooting guidance, and chain-specific content.
4. **No programmatic discovery** — No machine-readable metadata for token counts, freshness, or content hashing. Agent frameworks cannot make intelligent caching decisions.
5. **GitHub Action broken** — `update-llms-txt.yml` fails due to missing Node.js setup, fragile sed extraction, and no build verification.
6. **Token counting script missing** — `scripts/count-llm-tokens.ts` referenced in `package.json` but never created.

## Proposed Solution

**Tiered + Protocol hybrid** — Curated content tiers plus structured metadata.

## Technical Approach

### Architecture

```
Agent Discovery Flow:

  /llms.txt (Tier 1, ~1.5k tokens)
       │
       ├───────────────────┬───────────────────┐
       ▼                   ▼                   ▼
  /llms-price-feeds-   /llms-price-feeds-   /llms-entropy.txt
  core.txt             pro.txt              (Tier 2, ~8-10k)
  (Tier 2, ~8-10k)    (Tier 2, ~8-10k)
       │                   │                   │
       ▼                   ▼                   ▼
  /{page}.mdx          /{page}.mdx          /{page}.mdx
  (Tier 3, full page)  (Tier 3, full page)  (Tier 3, full page)

  /llms-manifest.json ── programmatic discovery (token counts, hashes, timestamps)
  /llms-price-feeds.txt ── routing page between Core and Pro (~2k tokens)
```

Key design decisions:
- **Remove `getLLMTextByPaths()` from Tier 2** — All Tier 2 content becomes fully curated static content. No dynamic MDX dumps.
- **`/llms-price-feeds.txt` (combined)** — Becomes a brief routing page (~2k tokens) describing both Core and Pro, linking to their individual files. Avoids duplication and stays under budget.
- **Token counting** — Build-time computation via `count-llm-tokens.ts`, outputs JSON file imported by manifest route handler.
- **Tokenizer** — `cl100k_base` (GPT-4/GPT-4o) with disclaimer that counts are approximate across models.

### Implementation Phases

#### Phase 1: Foundation (Token Counting + Tier 2 Template)

**Goal:** Create the infrastructure needed before restructuring content.

##### Task 1.1: Create token counting script

**File:** `scripts/count-llm-tokens.ts` (new)

```typescript
// Uses js-tiktoken (already a devDependency) with cl100k_base encoding
// Fetches each Tier 1/2 route's content by importing the route handlers
// Writes output to src/data/llm-token-counts.json
// CLI: pnpm count:llm-tokens
```

**Output format** (`src/data/llm-token-counts.json`):
```json
{
  "generated_at": "2026-02-11T12:00:00Z",
  "tokenizer": "cl100k_base",
  "files": {
    "/llms.txt": { "tokens": 1450, "bytes": 5200, "hash": "sha256:abc..." },
    "/llms-price-feeds-core.txt": { "tokens": 8200, "bytes": 29000, "hash": "sha256:def..." }
  }
}
```

**Acceptance criteria:**
- [x] Script runs via `pnpm count:llm-tokens`
- [x] Outputs JSON to `src/data/llm-token-counts.json`
- [x] Counts tokens for all Tier 1 and Tier 2 files
- [x] Computes SHA-256 content hashes
- [x] Uses `cl100k_base` encoding from `js-tiktoken`

##### Task 1.2: Define Tier 2 section template

All Tier 2 product files will follow this consistent structure:

```
# {Product Name} — Quick Start

> {One-line description}
> This file contains a curated quick-start. For full docs, fetch individual pages below.

## Overview
{2-3 paragraphs: what it is, when to use it, key differentiators}

## Key Concepts
{Core concepts an agent needs to understand before integrating}

## Integration Code
### {Chain 1: e.g., EVM / Solidity}
{Concise, tested code snippet}

### {Chain 2: e.g., Solana / Rust or TypeScript}
{Concise, tested code snippet}

## Contract Addresses / Endpoints
{Top networks only — link to full list via Tier 3 URL}

## Popular Feed IDs / Parameters
{Top 10-20 items — link to full list}

## Common Patterns
{3-5 patterns: stale price handling, multi-chain deployment, error recovery}

## Troubleshooting
{3-5 common issues with solutions, sourced from existing docs}

## Deep Dive Pages
For complete documentation, fetch any page as markdown:
- [{Page title}](https://docs.pyth.network/{path}.mdx) — {brief description}
- ...

Generated on: {ISO timestamp}
```

**Acceptance criteria:**
- [x] Template documented (this plan serves as documentation)
- [x] Deep dive links use absolute URLs with `.mdx` extension
- [x] Each section has a clear purpose and token budget guideline

---

#### Phase 2: Tier 2 Content Restructure

**Goal:** Rewrite all four product files to curated content following the template. Remove `getLLMTextByPaths()` calls.

##### Task 2.1: Restructure `/llms-price-feeds-core.txt`

**File:** `src/app/llms-price-feeds-core.txt/route.ts`

Changes:
- Rewrite `STATIC_HEADER` following the Tier 2 template
- Remove `getLLMTextByPaths(["/price-feeds/core", "/api-reference/pyth-core"])` call
- Remove `import { getLLMTextByPaths }` if no longer needed
- The entire response is now the curated static content + timestamp
- Keep `Cache-Control: public, max-age=3600` and `revalidate = false`
- Add "Common Patterns" section (stale price handling, confidence intervals, update fee estimation)
- Add "Troubleshooting" section (common integration errors from existing docs)
- Curate "Deep Dive Pages" list with titles and brief descriptions for key pages

Content sources for curation:
- Existing static header (lines 7-108 of current file): quick-starts, feed IDs, addresses, SDKs — keep and refine
- `content/docs/price-feeds/core/` MDX files: extract common patterns and troubleshooting from getting-started, pull-integration guides
- `content/docs/api-reference/pyth-core/hermes/` MDX files: extract key API endpoints

**Acceptance criteria:**
- [x] File is fully static (no `getLLMTextByPaths` call)
- [x] Under 10k tokens (validate with `pnpm count:llm-tokens`) — 2,473 tokens
- [x] Follows Tier 2 template structure
- [x] Contains integration code for EVM (Solidity) and Solana/TypeScript
- [x] Deep dive links use `.mdx` extension URLs
- [x] An agent can integrate Pyth Core on EVM using only this file

##### Task 2.2: Restructure `/llms-price-feeds-pro.txt`

**File:** `src/app/llms-price-feeds-pro.txt/route.ts`

Same approach as Task 2.1 but for Pyth Pro content:
- Rewrite to curated template
- Remove `getLLMTextByPaths(["/price-feeds/pro"])` call
- Content from `content/docs/price-feeds/pro/` MDX files
- Include WebSocket connection patterns, subscription setup, on-chain verification
- Verify SDK naming consistency: current header uses `@pythnetwork/pyth-pro-client` but `SKILL.md` references `@pythnetwork/pyth-lazer-sdk` — resolve which is correct

**Acceptance criteria:**
- [x] Under 10k tokens — 2,261 tokens
- [x] Follows Tier 2 template
- [x] SDK name is correct and consistent with SKILL.md — `@pythnetwork/pyth-lazer-sdk` / `PythLazerClient`
- [x] Contains WebSocket quick-start and REST API examples

##### Task 2.3: Restructure `/llms-entropy.txt`

**File:** `src/app/llms-entropy.txt/route.ts`

Same approach for Entropy:
- Remove `getLLMTextByPaths(["/entropy", "/api-reference/entropy"])` call
- Content from `content/docs/entropy/` and `content/docs/api-reference/entropy/fortuna/` MDX files
- Include commit-reveal flow explanation, callback pattern, fee handling

**Acceptance criteria:**
- [x] Under 10k tokens — 1,962 tokens
- [x] Follows Tier 2 template
- [x] Contains EVM integration code with IEntropyConsumer pattern (v2 API)

##### Task 2.4: Restructure `/llms-price-feeds.txt` (combined)

**File:** `src/app/llms-price-feeds.txt/route.ts`

**Different approach:** This becomes a routing page, not a full Tier 2 file.

```
# Pyth Price Feeds — Overview

> This file covers both Pyth Core and Pyth Pro. For detailed docs, fetch the specific product file below.

## Pyth Core (Decentralized Oracle)
{3-paragraph overview of Core}
Full documentation: https://docs.pyth.network/llms-price-feeds-core.txt

## Pyth Pro (Low-Latency Streaming)
{3-paragraph overview of Pro}
Full documentation: https://docs.pyth.network/llms-price-feeds-pro.txt

## Which Should I Use?
{Decision matrix: Core for DeFi/on-chain, Pro for HFT/MEV/institutional}

## Common Quick Start (TypeScript)
{Brief HermesClient example that works for both products}

Generated on: {ISO timestamp}
```

- Remove `getLLMTextByPaths(["/price-feeds", "/api-reference/pyth-core"])` call
- Target ~2k tokens (routing + brief overviews)
- No duplication of Core or Pro content

**Acceptance criteria:**
- [x] Under 3k tokens — 705 tokens
- [x] Clearly routes to Core and Pro individual files
- [x] Contains decision matrix for product selection
- [x] No content duplication with Core or Pro files

---

#### Phase 3: Tier 1 Restructure

**Goal:** Rewrite the routing index with rich product summaries.

##### Task 3.1: Rewrite `/llms.txt`

**File:** `src/app/llms.txt/route.ts`

Restructure from mechanical routing table to rich overview:

```
# Pyth Network Documentation

> First-party financial oracle delivering real-time market data to 100+ blockchains.

## AI Agent Playbook
For an opinionated integration guide with code snippets and step-by-step procedures:
> https://docs.pyth.network/SKILL.md

## Products

### Pyth Core — Decentralized Price Oracle
Pull-based oracle providing 500+ price feeds with 400ms updates across 100+ chains.
Best for: DeFi protocols, lending, DEXs, derivatives.
Chains: EVM, Solana, Sui, Aptos, Cosmos, and more.
> https://docs.pyth.network/llms-price-feeds-core.txt

### Pyth Pro — Low-Latency Price Streaming
Enterprise WebSocket streaming for institutional and latency-sensitive applications.
Best for: HFT, MEV strategies, market making, risk management.
> https://docs.pyth.network/llms-price-feeds-pro.txt

### Entropy — On-Chain Randomness (VRF)
Secure verifiable random number generation using commit-reveal.
Best for: Gaming, NFT mints, lotteries, fair selection.
> https://docs.pyth.network/llms-entropy.txt

### Express Relay — MEV Protection
Auction-based MEV capture and order flow protection for DeFi protocols.
Documentation: https://docs.pyth.network/express-relay/index.mdx

## Unsure Which Product?
> https://docs.pyth.network/llms-price-feeds.txt (compares Core vs Pro)

## Individual Page Access
Append .mdx to any documentation URL for plain markdown:
  Example: https://docs.pyth.network/price-feeds/core/getting-started.mdx

## Machine-Readable Metadata
> https://docs.pyth.network/llms-manifest.json

## Instructions for AI Agents
1. Read the product descriptions above to identify which product the user needs.
2. Fetch exactly ONE product file — each is self-contained.
3. For deeper detail, fetch individual pages via .mdx URLs listed in each product file.
```

- Keep `Cache-Control: public, max-age=86400` (24 hours)
- Express Relay links to `.mdx` page (consistent format, even without a dedicated `.txt` file)
- Reference manifest for programmatic consumers

**Acceptance criteria:**
- [x] Under 2k tokens — 518 tokens
- [x] Each product has description, use cases, and supported chains/features
- [x] Express Relay links to `.mdx` (not HTML page)
- [x] References manifest and SKILL.md
- [x] Instructions section guides agent behavior

---

#### Phase 4: Protocol Layer

**Goal:** Add machine-readable metadata for programmatic discovery.

##### Task 4.1: Create `/llms-manifest.json` endpoint

**File:** `src/app/llms-manifest.json/route.ts` (new)

Route handler that serves the manifest JSON. Imports pre-computed token counts from `src/data/llm-token-counts.json`.

**Manifest schema:**
```json
{
  "version": "1.0",
  "name": "Pyth Network",
  "description": "Decentralized oracle network for price feeds, randomness, and MEV protection",
  "base_url": "https://docs.pyth.network",
  "generated_at": "2026-02-11T12:00:00Z",
  "tokenizer": "cl100k_base",
  "tokenizer_note": "Token counts are approximate. Actual counts vary by model.",
  "files": [
    {
      "path": "/llms.txt",
      "title": "Routing Index",
      "description": "Product overview and routing to detailed documentation",
      "tier": 1,
      "token_count": 1450,
      "content_hash": "sha256:abc123...",
      "cache_max_age": 86400,
      "topics": ["overview", "routing"]
    },
    {
      "path": "/llms-price-feeds-core.txt",
      "title": "Pyth Core — Price Oracle",
      "description": "Decentralized pull-based oracle for DeFi. Covers EVM, Solana, Sui, Aptos.",
      "tier": 2,
      "token_count": 8200,
      "content_hash": "sha256:def456...",
      "cache_max_age": 3600,
      "topics": ["oracle", "price-feed", "defi", "evm", "solana", "sui", "aptos"]
    },
    {
      "path": "/llms-price-feeds-pro.txt",
      "title": "Pyth Pro — Low-Latency Streaming",
      "description": "Enterprise WebSocket price streaming for HFT and institutional use.",
      "tier": 2,
      "token_count": 7500,
      "content_hash": "sha256:ghi789...",
      "cache_max_age": 3600,
      "topics": ["streaming", "websocket", "hft", "mev", "low-latency"]
    },
    {
      "path": "/llms-entropy.txt",
      "title": "Entropy — On-Chain Randomness",
      "description": "Verifiable random number generation for gaming and fair selection.",
      "tier": 2,
      "token_count": 6800,
      "content_hash": "sha256:jkl012...",
      "cache_max_age": 3600,
      "topics": ["randomness", "vrf", "gaming", "nft"]
    },
    {
      "path": "/llms-price-feeds.txt",
      "title": "Price Feeds — Core vs Pro Overview",
      "description": "Comparison and routing between Core and Pro price feed products.",
      "tier": 1,
      "token_count": 2000,
      "content_hash": "sha256:mno345...",
      "cache_max_age": 3600,
      "topics": ["overview", "comparison", "routing"]
    },
    {
      "path": "/SKILL.md",
      "title": "Pyth Developer Playbook",
      "description": "Opinionated integration guide with step-by-step procedures and code snippets.",
      "tier": 1,
      "token_count": 4500,
      "content_hash": "sha256:pqr678...",
      "cache_max_age": 86400,
      "topics": ["integration", "tutorial", "playbook"]
    }
  ],
  "page_access": {
    "pattern": "https://docs.pyth.network/{path}.mdx",
    "description": "Append .mdx to any documentation URL for plain markdown content",
    "example": "https://docs.pyth.network/price-feeds/core/getting-started.mdx"
  }
}
```

- `Cache-Control: public, max-age=86400` (24 hours, same as Tier 1)
- `Content-Type: application/json; charset=utf-8`
- Import token counts from `src/data/llm-token-counts.json` at build time
- `revalidate = false`

**Acceptance criteria:**
- [x] Returns valid JSON matching schema above
- [x] Token counts and hashes are accurate (imported from build-time data)
- [x] All Tier 1 and Tier 2 files are listed
- [x] `llms-full.txt` is NOT listed (deprecated)
- [x] Topics are relevant and searchable

##### Task 4.2: Add `sitemap.xml` generation

**File:** `src/app/sitemap.ts` (new)

Next.js App Router supports [dynamic sitemap generation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) via a `sitemap.ts` file. This improves discoverability for both search engine crawlers and AI agent crawlers.

```typescript
import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docs.pyth.network";

  // All documentation pages from fumadocs
  const docPages = source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
  }));

  // LLM-specific endpoints
  const llmPages = [
    { url: `${baseUrl}/llms.txt`, changeFrequency: "monthly" as const },
    { url: `${baseUrl}/llms-price-feeds-core.txt`, changeFrequency: "weekly" as const },
    { url: `${baseUrl}/llms-price-feeds-pro.txt`, changeFrequency: "weekly" as const },
    { url: `${baseUrl}/llms-entropy.txt`, changeFrequency: "weekly" as const },
    { url: `${baseUrl}/llms-price-feeds.txt`, changeFrequency: "monthly" as const },
    { url: `${baseUrl}/llms-manifest.json`, changeFrequency: "weekly" as const },
    { url: `${baseUrl}/SKILL.md`, changeFrequency: "monthly" as const },
  ].map((p) => ({ ...p, lastModified: new Date() }));

  return [...docPages, ...llmPages];
}
```

**Acceptance criteria:**
- [x] `/sitemap.xml` returns valid XML sitemap
- [x] Includes all documentation pages from fumadocs source
- [x] Includes all llm.txt endpoints and manifest
- [x] Includes SKILL.md

##### Task 4.3: Update `/llms-full.txt` deprecation notice

**File:** `src/app/llms-full.txt/route.ts` (modify)

Update the deprecation notice to reference the new tiered system and manifest:

```
# This endpoint is deprecated

Pyth documentation is now served through a tiered system:

1. Start here: https://docs.pyth.network/llms.txt
2. Machine-readable index: https://docs.pyth.network/llms-manifest.json

The monolithic full-documentation file has been replaced by curated,
product-specific files that are more efficient for AI agents.
```

**Acceptance criteria:**
- [x] References both `/llms.txt` and `/llms-manifest.json`
- [x] Clear explanation of why this file was deprecated

---

#### Phase 5: GitHub Action Fix

**Goal:** Fix the broken workflow and adapt it to the new fully-curated architecture.

##### Task 5.1: Fix immediate failures in `update-llms-txt.yml`

**File:** `.github/workflows/update-llms-txt.yml` (modify)

Fixes:
1. **Add Node.js and pnpm setup** — Use `actions/setup-node@v4` with `node-version: 24` and `pnpm/action-setup@v4`. This fixes the `npx biome` failure at line 323.
2. **Install dependencies** — Run `pnpm install --frozen-lockfile` in the developer-hub directory so Biome is available locally.
3. **Update `KNOWN_DIRS`** (line 113) — Add `express-relay`, `oracle-integrity-staking`, `metrics`, `pyth-token` to prevent false "new product detected" alerts.
4. **Add error handling for GPT-4o response** — Validate JSON structure before applying changes. Check for HTTP errors (429, 503) from the OpenAI API.

##### Task 5.2: Adapt Action to fully-curated architecture

Since Tier 2 files are now fully static (no `getLLMTextByPaths()`), the Action's approach needs updating.

**Trigger:** On every PR commit that changes files in `apps/developer-hub/content/docs/**/*.mdx` or `apps/developer-hub/content/docs/**/*.md`.

**Detection logic:**
1. Identify changed doc files in the commit
2. Map changed paths to affected product files:
   - `content/docs/price-feeds/core/**` → `llms-price-feeds-core.txt/route.ts`
   - `content/docs/price-feeds/pro/**` → `llms-price-feeds-pro.txt/route.ts`
   - `content/docs/entropy/**` → `llms-entropy.txt/route.ts`
   - `content/docs/api-reference/pyth-core/**` → `llms-price-feeds-core.txt/route.ts`
   - `content/docs/api-reference/entropy/**` → `llms-entropy.txt/route.ts`
3. **SKILL.md detection** — If changes touch key pages (getting-started, index, contract-addresses, SDK references) or if any product file is being updated, also flag `SKILL.md/route.ts` for review. SKILL.md contains code snippets and SDK references that must stay in sync.
4. If changes also affect `/price-feeds/core/**` or `/price-feeds/pro/**`, also flag `llms-price-feeds.txt/route.ts` (the combined routing page)

**Update flow per affected file:**
1. Extract the full content string (everything inside the template literal `const CONTENT = \`...\``)
2. Send to GPT-4o with: current content + diff of what changed in the PR + the Tier 2 template structure
3. GPT-4o returns the updated content if changes are needed (or "NO_CHANGES" if not)
4. Replace the full content string in the route file
5. Run Biome format on all modified files
6. **Append a single commit** to the PR branch with all updated files (llm.txt routes + SKILL.md if changed)
7. Post/update a PR comment summarizing what was reviewed and what changed

Rename the template literal from `STATIC_HEADER` to `CONTENT` in all route files to reflect that there is no longer a dynamic section.

**GPT-4o system prompt updates:**
- The entire file is curated content (not just a header)
- Must follow the Tier 2 template structure
- Should not add unnecessary content (YAGNI principle)
- For SKILL.md: keep code snippets, SDK names, and progressive disclosure links consistent with the product files
- Return `NO_CHANGES` if the doc changes don't affect the curated content (e.g., minor typo in a deep-dive page that isn't referenced in the quick-start)

**Acceptance criteria for Phase 5 tasks:**
- [x] Action installs Node.js 24 and pnpm
- [x] Action installs project dependencies
- [x] Biome formatting works correctly
- [x] `KNOWN_DIRS` includes all content directories
- [x] GPT-4o errors are handled gracefully
- [x] Content extraction works with renamed template literal
- [x] SKILL.md is included in the review scope when relevant changes are detected

---

#### Phase 6: Cleanup and Validation

##### Task 6.1: Update SKILL.md

**File:** `src/app/SKILL.md/route.ts` (modify)

This is the AI agent playbook — it must stay consistent with the restructured Tier 2 files.

Review and update:
- **Progressive disclosure links** (lines 246-248) — update URLs and descriptions to match restructured Tier 2 file content
- **SDK names** — resolve `pyth-pro-client` vs `pyth-lazer-sdk` inconsistency, use whichever is correct in both SKILL.md and Tier 2 files
- **Code snippets** — verify quick-start code in SKILL.md matches the curated code in Tier 2 files (no conflicting examples)
- **Product reference table** — update if product descriptions or capabilities changed
- **Add manifest reference** — add `/llms-manifest.json` to the progressive disclosure section for programmatic consumers
- **Tiered system awareness** — add a brief note explaining the tiered doc system so agents understand how to navigate (SKILL.md for opinionated guidance, Tier 2 for reference, Tier 3 for deep dives)

**Acceptance criteria:**
- [x] All links in SKILL.md point to valid, current URLs
- [x] SDK names match across SKILL.md and all Tier 2 files
- [x] Code snippets are consistent (no conflicting examples between SKILL.md and Tier 2)
- [x] Manifest is referenced in progressive disclosure section

##### Task 6.2: Add error handling to Tier 3 route

**File:** `src/app/mdx/[...slug]/route.ts` (modify)

Wrap `getLLMText()` call in try-catch. Return 404 with plain-text message if the source file is missing on disk but the page exists in the source map.

##### Task 6.3: Build and validate

- Run `pnpm count:llm-tokens` to verify token budgets locally
- Build the project: `pnpm turbo run build`
- Verify sitemap.xml is generated correctly

##### Task 6.4: Lint and type-check

- `pnpm turbo run test:lint`
- `pnpm turbo run test:types`

## Alternative Approaches Considered

1. **Dynamic API endpoint** (`GET /api/llm?product=core&sections=quickstart,addresses`) — Maximum flexibility but high complexity, breaks simple `curl /llms.txt` compatibility, and over-engineers for current needs.
2. **Keep dynamic MDX dumps but add filtering** — Lower effort but does not solve the structure or token waste problems.
3. **Tiered only (no protocol layer)** — Simpler but misses discoverability and caching benefits of structured metadata.

## Acceptance Criteria

### Functional Requirements
- [x] All existing URLs continue to work (no breaking changes)
- [x] `/llms.txt` returns rich product overview with descriptions and use cases
- [x] Tier 2 files return curated quick-starts following consistent template
- [x] `/llms-manifest.json` returns valid JSON with token counts and content hashes
- [x] `/llms-full.txt` shows updated deprecation notice
- [x] An agent can integrate Pyth Core on EVM using only Tier 1 + Tier 2 (no Tier 3)

### Non-Functional Requirements
- [x] Tier 2 files under 10k tokens each
- [x] Tier 1 files under 2k tokens
- [x] Combined price-feeds file under 3k tokens
- [x] All code snippets in Tier 2 are tested/verified against current SDKs
- [x] GitHub Action successfully processes doc-change PRs

### Quality Gates
- [x] `pnpm turbo run build` succeeds
- [x] `pnpm turbo run test:lint` passes
- [x] `pnpm turbo run test:types` passes
- [x] `pnpm count:llm-tokens` validates all budgets
- [ ] Manual test: fetch each endpoint and verify content quality

## Dependencies & Prerequisites

- `js-tiktoken` already installed as devDependency
- OpenAI API key in GitHub Secrets (`PYTH_NETWORK_PYTH_CROSSCHAIN_OPENAI_API_KEY`) — needed for GitHub Action
- Familiarity with existing MDX content for curation decisions

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Curated content becomes stale | Agents get outdated info | GitHub Action auto-reviews on doc changes, including SKILL.md |
| Token budget too tight for comprehensive content | Missing important context | Start at 10k budget, measure after curation, adjust if needed |
| GitHub Action GPT-4o produces bad edits | Broken content committed | JSON schema validation + human review required on PR |
| Agents have old Tier 1 cached | Stale routing for up to 24h | No action needed — old format still works (same URLs) |

## Implementation Sequence

```
Phase 1 (Foundation)          → Phase 2 (Tier 2 Restructure)
  1.1 Token counting script        2.1 Core price feeds
  1.2 Template definition           2.2 Pro price feeds
                                     2.3 Entropy
                                     2.4 Combined price feeds
                                          │
Phase 3 (Tier 1 Restructure)  ←──────────┘
  3.1 Rewrite llms.txt
          │
Phase 4 (Protocol Layer)      ←──────────┘
  4.1 Manifest endpoint
  4.2 Sitemap generation
  4.3 Update deprecation notice
          │
Phase 5 (GitHub Action)       ←──────────┘
  5.1 Fix immediate failures
  5.2 Adapt to curated architecture (includes SKILL.md scope)
          │
Phase 6 (Cleanup)             ←──────────┘
  6.1 Update SKILL.md
  6.2 Tier 3 error handling
  6.3 Build and validate
  6.4 Lint and type-check
```

**Phases 2.1–2.4 can be done in parallel.** All other phases are sequential.

## Files Affected

### Modified
| File | Phase | Change |
|------|-------|--------|
| `src/app/llms.txt/route.ts` | 3.1 | Rewrite to rich product overview |
| `src/app/llms-price-feeds-core.txt/route.ts` | 2.1 | Curated Tier 2, remove `getLLMTextByPaths` |
| `src/app/llms-price-feeds-pro.txt/route.ts` | 2.2 | Curated Tier 2, remove `getLLMTextByPaths` |
| `src/app/llms-entropy.txt/route.ts` | 2.3 | Curated Tier 2, remove `getLLMTextByPaths` |
| `src/app/llms-price-feeds.txt/route.ts` | 2.4 | Routing page between Core and Pro |
| `src/app/llms-full.txt/route.ts` | 4.3 | Updated deprecation notice |
| `src/app/SKILL.md/route.ts` | 6.1 | Update references, SDK names, code snippets, add manifest link |
| `src/app/mdx/[...slug]/route.ts` | 6.2 | Add error handling |
| `.github/workflows/update-llms-txt.yml` | 5.1–5.2 | Fix, adapt, add SKILL.md to review scope |

### Created
| File | Phase | Purpose |
|------|-------|---------|
| `scripts/count-llm-tokens.ts` | 1.1 | Token counting CLI tool |
| `src/data/llm-token-counts.json` | 1.1 | Build-time token count data |
| `src/app/llms-manifest.json/route.ts` | 4.1 | Manifest endpoint |
| `src/app/sitemap.ts` | 4.2 | Dynamic sitemap generation |

### Potentially Unchanged
| File | Notes |
|------|-------|
| `src/lib/get-llm-text.ts` | Still used by Tier 3 (`/mdx/[...slug]`). No changes unless cleanup desired. |
| `src/lib/source.ts` | No changes needed |

## Future Considerations

- **Express Relay llm.txt** — Create `/llms-express-relay.txt` when ready (out of scope)
- **Dynamic API endpoint** — Could be added as Phase 2 of improvements if demand exists
- **ETag/Last-Modified headers** — Enable conditional requests for bandwidth savings
- **Rate limiting** — Monitor for aggressive agent crawlers, add if needed
- **Additional product coverage** — Oracle Integrity Staking, Metrics, Pyth Token could get Tier 2 files

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-11-llm-txt-improvements-brainstorm.md`
- Current route handlers: `src/app/llms*.txt/route.ts`
- Core library: `src/lib/get-llm-text.ts:1-53`
- GitHub Action: `.github/workflows/update-llms-txt.yml:1-442`
- Project conventions: `AGENTS.md`
- Fumadocs source: `src/lib/source.ts`, `source.config.ts`
- OpenAPI config (pattern reference): `src/lib/openapi.ts`

### External References
- llms.txt convention: https://llmstxt.org/
- Fumadocs documentation: https://fumadocs.vercel.app/
- js-tiktoken: https://github.com/nicolo-ribaudo/js-tiktoken

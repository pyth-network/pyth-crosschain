# Brainstorm: Improve llm.txt for AI Agent Accessibility

**Date:** 2026-02-11
**Status:** Ready for planning

## What We're Building

A **Tiered + Protocol hybrid** improvement to the Developer Hub's llm.txt system that makes Pyth documentation more accessible, efficient, and discoverable for AI agents of all types (coding assistants, autonomous agents, chat-based AI).

### Goals
- Reduce token waste by ~10x through curated tiered content
- Add machine-readable metadata for programmatic discovery
- Fix the broken GitHub Action that keeps llm.txt files fresh
- Improve content structure with consistent headings across all product files

### Out of Scope (for now)
- Express Relay llm.txt file (future work)
- Dynamic API endpoint (potential Phase 2)
- Oracle Integrity Staking, Metrics, Pyth Token coverage

## Why This Approach

We chose the Tiered + Protocol hybrid because:

1. **Tiered Restructure** solves the immediate content quality problems — files are too verbose (full MDX dumps), poorly structured, and missing curated context. A 3-tier hierarchy (routing index -> curated quick-starts -> full pages on demand) gives agents exactly the right level of detail.

2. **Protocol Layer** adds structured metadata (`llms-manifest.json`) so agent frameworks can programmatically discover docs, check token counts, and cache intelligently. This is low-effort to add alongside the restructure and future-proofs the system.

3. **GitHub Action fix** ensures content stays fresh automatically as docs change, addressing the staleness problem.

### Alternatives Considered

- **Tiered only**: Simpler but misses the discoverability and caching benefits of structured metadata.
- **Dynamic API**: Maximum flexibility (query by product/chain/section) but high complexity, breaks simple `curl /llms.txt` compatibility, and over-engineers for current needs. Could be a future phase.

## Key Decisions

### 1. Three-Tier Content Hierarchy

| Tier | File | Token Budget | Content |
|------|------|-------------|---------|
| 1 | `/llms.txt` | ~1.5k tokens | Product summaries with capabilities, routing to Tier 2 |
| 2 | `/llms-{product}.txt` | ~8-10k tokens each | Curated quick-start: key concepts, code snippets, contract addresses, common patterns |
| 3 | `/{page}.mdx` | Full page | On-demand full page content (already exists) |

**Tier 1 (`/llms.txt`)** — Currently a mechanical routing table ("if X, fetch Y"). Will become a rich overview that tells agents *what Pyth does* with enough context to route intelligently. Includes product descriptions, use cases, and links.

**Tier 2 (`/llms-{product}.txt`)** — Currently dumps every MDX page into a single file. Will become curated content: key concepts (3 paragraphs max), integration code per chain, top contract addresses, popular feed IDs, common patterns. Links to Tier 3 for deep dives.

**Tier 3 (`/{page}.mdx`)** — Already works. No changes needed.

### 2. Protocol Layer: Structured Metadata

Add `/llms-manifest.json` with:
- Product file paths, descriptions, topics
- Token counts per file (auto-calculated)
- Last-updated timestamps and content hashes
- Page discovery pattern (`/{path}.mdx`)

### 3. Consistent Section Structure

All Tier 2 product files will follow a standard template:
```
# {Product Name} — Quick Start
## Overview (what it is, when to use it)
## Key Concepts
## Integration Code ({chain})
## Contract Addresses / Endpoints
## Common Patterns
## Troubleshooting
## Deep Dive Pages (links to Tier 3)
```

### 4. GitHub Action Fix

Diagnose and fix the existing `update-llms-txt.yml` workflow. It currently uses GPT-4o to review static headers when docs change. The fix should ensure:
- Workflow triggers correctly on doc changes
- Header review and updates work reliably
- Token counts in manifest are updated on each build
- Format/lint passes after automated updates

### 5. Caching Strategy

- Tier 1 (`/llms.txt`, manifest): `max-age=86400` (24 hours) — changes infrequently
- Tier 2 (product files): `max-age=3600` (1 hour) — reflects doc updates
- Tier 3 (per-page MDX): `max-age=3600` (1 hour) — already set

## Audience

All types of AI agents:
- **Developer AI assistants** (Cursor, Copilot, Claude Code) helping devs integrate Pyth
- **Autonomous agents** building DeFi apps or managing positions
- **Chat-based AI** (ChatGPT, Claude) answering user questions about Pyth

## Open Questions

1. **Token counting in CI**: Should the manifest's token counts be updated on every build, or only when content actually changes? (Build-time is simpler; change-detection is more efficient.)
2. **SKILL.md relationship**: Should `/SKILL.md` be updated to reference the new tiered system, or does it serve a sufficiently different purpose (opinionated playbook vs. raw docs)?
3. **Sitemap**: Should we add a `sitemap.xml` as part of this work for additional discoverability? (Low effort, high value for crawlers.)

## Files Affected

### Existing files to modify
- `src/app/llms.txt/route.ts` — Rewrite Tier 1 routing index
- `src/app/llms-price-feeds-core.txt/route.ts` — Restructure to curated Tier 2
- `src/app/llms-price-feeds-pro.txt/route.ts` — Restructure to curated Tier 2
- `src/app/llms-price-feeds.txt/route.ts` — Restructure to curated Tier 2 (combined)
- `src/app/llms-entropy.txt/route.ts` — Restructure to curated Tier 2
- `src/app/llms-full.txt/route.ts` — Update deprecation notice or repurpose
- `src/app/SKILL.md/route.ts` — Potentially update references
- `.github/workflows/update-llms-txt.yml` — Fix and enhance

### New files to create
- `src/app/llms-manifest.json/route.ts` — Manifest endpoint

## Success Criteria

- Tier 2 files are under 10k tokens each (verify with token counting script)
- An agent can integrate Pyth Core on EVM using only Tier 1 + Tier 2 (no Tier 3 needed)
- `llms-manifest.json` returns accurate token counts and timestamps
- GitHub Action successfully updates headers on doc-change PRs
- All existing URLs continue to work (no breaking changes)

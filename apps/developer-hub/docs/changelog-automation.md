# Change Log automation

How the Price Feeds [Change Log](../content/docs/price-feeds/changelog.mdx) page
stays up to date.

## Architecture

```
  Hermes (daily)                         changelog-data branch        Vercel
  ───────────────                        (unprotected data store)     ──────
  1. compute the day's diff       ┌────────────────────────────┐
  2. write <UTC-date>.json   ───▶ │ apps/developer-hub/data/    │
     git push                     │   changelog-diffs/<date>.json│
  3. POST the deploy hook  ───────┼────────────────────────────┼──▶ rebuild main
                                  └────────────────────────────┘        │
  main:  code only, no data            build: pull:changelog  ◀─────────┘
         (data/changelog-diffs/         (git archive from changelog-data)
          is gitignored)                generate:changelog → bundles last 15
                                        → page renders (build-time, SSR)
```

- **main never receives an automated commit.** The daily data lives only on the
  `changelog-data` branch, so no branch-protection bypass, PAT, or bot/app is
  needed. Hermes pushes to `changelog-data` with its normal write access.
- **Build-time, not runtime.** `pull:changelog` (`scripts/pull-changelog-data.sh`)
  hydrates the diffs from `changelog-data` at build, then `generate:changelog`
  bundles the most recent 15 day-files into `generated-data.ts`. No CMS, no
  runtime fetch.
- A Vercel **Deploy Hook** is what turns a data push into a fresh deployment
  (a push to `changelog-data` does not auto-deploy).

## What Hermes must do, daily

1. **Compute** the day's status transitions (added / went live / removed).
2. **Write** one file to the `changelog-data` branch at
   `apps/developer-hub/data/changelog-diffs/<UTC-date>.json` (e.g.
   `2026-06-18.json`), in the `Day` shape below.
   - Idempotent per UTC day: if the file already exists, skip (don't duplicate).
   - Days with no transitions: still fine to write an empty day (events `[]`),
     or skip the day entirely — the build tolerates gaps.
3. **Push** to `changelog-data`.
4. **POST** the Vercel deploy hook to trigger the rebuild.

```bash
REPO=git@github.com:pyth-network/pyth-crosschain.git
DATE=$(date -u +%F)
DIR=apps/developer-hub/data/changelog-diffs

git clone --branch changelog-data --single-branch --depth 1 "$REPO" /tmp/cl
# ...write /tmp/cl/$DIR/$DATE.json...
git -C /tmp/cl add "$DIR/$DATE.json"
git -C /tmp/cl commit -m "chore(developer-hub): change-log diff $DATE"
git -C /tmp/cl push origin changelog-data
curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"
```

## `Day` JSON schema

Defined in `scripts/changelog-lib.ts` (and `src/components/ChangeLog/data.ts`).
Key order does not matter (the data dir is excluded from biome).

```jsonc
{
  "date": "2026-06-18",          // YYYY-MM-DD, UTC; must match the filename
  "label": "Thursday",           // weekday name (UTC)
  "summary": { "added": 1, "went_live": 2, "removed": 0 },
  "hero": "1 new feed announced, 2 went live.",  // one-line summary
  "events": [
    {
      "id": "Crypto.GRAM/USD",   // the symbol
      "lazerId": 3330,           // pyth_lazer_id (number)
      "asset": "Gram",           // display name
      "assetType": "crypto",     // equity | crypto | fx | metal | commodity | rates | …
      "quote": "USD",            // optional
      "hermesId": "…",           // optional
      "changeType": "went_live", // "added" | "went_live" | "removed"
      "date": "2026-06-18"
    }
  ]
}
```

- `changeType` is one of `added`, `went_live`, `removed`. (`expiring_soon` was
  intentionally dropped — Pyth feeds expose no scheduled-deactivation date, so
  an expiry surfaces as `removed` when the contract goes inactive.)
- `summary` counts must match the `events` of each type. The build sums these
  across the bundled window for the "Last 14 days" card.
- The reference diff logic lives in `scripts/changelog-lib.ts` (`diffPair`) and
  the local/backfill producer in `scripts/snapshot-and-diff.ts`, kept for manual
  runs. Production data is owned by Hermes.

## Vercel deploy hook (one-time setup)

Project → Settings → Git → Deploy Hooks → create one on branch `main`. Copy the
URL (treat as a secret) and give it to Hermes as `VERCEL_DEPLOY_HOOK_URL`.

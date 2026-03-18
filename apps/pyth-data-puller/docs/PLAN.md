# Pyth Data Puller — Implementation Plan

Internal web tool for self-serve historical Pyth Lazer price data exports.
Replaces the existing Retool workflow with a form UI, automated batch splitting,
S3 direct export, and a persistent dashboard of all export requests.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TAILSCALE NETWORK                                │
│            https://data-puller.your-tailnet.ts.net                      │
│                              │                                          │
│                     tailscale serve :3000                                │
│                              │                                          │
│  ┌───────────────────────────▼─────────────────────────────────────┐    │
│  │         pyth-data-puller (Next.js on localhost:3000)             │    │
│  │                                                                 │    │
│  │  ┌──────────────┐         ┌───────────────────────────────┐     │    │
│  │  │   React UI   │         │        API Routes              │     │    │
│  │  │              │         │                               │     │    │
│  │  │ Export Form  │────────▶│ POST /api/export              │     │    │
│  │  │  - name      │         │   1. Validate (min_channel)   │     │    │
│  │  │  - feeds     │         │   2. Auto-calc batch splits   │     │    │
│  │  │  - channel   │         │   3. Insert SQLite row        │     │    │
│  │  │  - columns   │         │   4. Write temp .env config   │     │    │
│  │  │  - dates     │         │   5. Spawn script process     │     │    │
│  │  │              │         │                               │     │    │
│  │  │ Dashboard    │◀───────▶│ GET /api/exports              │     │    │
│  │  │  - history   │         │   → SQLite query + CH process │     │    │
│  │  │  - status    │         │     check for in-progress     │     │    │
│  │  │  - S3 links  │         │                               │     │    │
│  │  │  - logs      │         │ GET /api/feeds                │     │    │
│  │  │              │         │   → Pyth symbols API (cached) │     │    │
│  │  │ Feed Search  │────────▶│                               │     │    │
│  │  └──────────────┘         └──────────┬────────────────────┘     │    │
│  │                                      │                          │    │
│  │         Secrets: process.env          │ spawn()                  │    │
│  │         via direnv/.envrc             │                          │    │
│  │         (from 1Password)              ▼                          │    │
│  │                           ┌───────────────────────┐              │    │
│  │                           │  scripts/              │              │    │
│  │                           │  run_lazer_export_s3.sh│─────────────┼───▶ S3
│  │                           │    (CH → S3 direct)   │              │    │ pyth-ch-share-public
│  │                           │    + EXPORT_COLUMNS   │─────────────┼───▶ ClickHouse
│  │                           │    + FEED_GROUP_SIZE  │              │    │ Lazer Production
│  │                           │    + index.html       │              │    │
│  │                           └───────────────────────┘              │    │
│  │                                      │                          │    │
│  │                           ┌──────────▼──────────┐               │    │
│  │                           │  SQLite (exports.db) │               │    │
│  │                           │  data/exports.db     │               │    │
│  │                           └─────────────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Next.js standalone on Tailscale server | No serverless timeout limits, monorepo-consistent |
| Execution | Shell out to existing bash/python scripts | Reuses battle-tested export logic, zero rewrite |
| S3 path | Direct CH→S3 via `INSERT INTO FUNCTION s3()` | Admin grant applied, no intermediate files |
| State tracking | SQLite + ClickHouse `system.processes` check | Persistent history + live process validation |
| Secrets | direnv/.envrc (1Password CLI) | Same pattern as existing scripts |
| Network access | `tailscale serve` → localhost:3000 | Network-level auth, zero app code |
| Feed catalog | Fetch from Pyth symbols API on form load | Always fresh, no stale static file |
| Query model | Predefined template, selectable columns | No raw SQL exposure, config injection safe |
| Which script | `run_lazer_export_s3.sh` only (extended) | Single script path, DRY |
| Init pattern | `instrumentation.ts` | Runs on boot: DB init + startup sweep |
| Timeout | 24 hours | Safety net for largest exports |
| Concurrency | 3 concurrent exports max | Protects shared ClickHouse cluster |
| Auto-split target | 500MB per file | Matches existing export file sizes |
| stdout handling | Stream to log file, tail last 50 lines | No memory growth, parse file count on exit |
| Script location | Copied into `apps/pyth-data-puller/scripts/` | Self-contained, no cross-directory coupling |

---

## File Structure

```
apps/pyth-data-puller/
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.example                     ← documents required env vars
├── scripts/
│   ├── run_lazer_export_s3.sh       ← from data_dump (+ EXPORT_COLUMNS support)
│   └── run_lazer_export_full.py     ← from data_dump (+ --output flag)
├── src/
│   ├── instrumentation.ts           ← DB init + startup sweep on boot
│   ├── app/
│   │   ├── layout.tsx               ← Root layout
│   │   ├── page.tsx                 ← Dashboard (export history table)
│   │   ├── new/
│   │   │   └── page.tsx             ← Export request form
│   │   └── api/
│   │       ├── export/
│   │       │   └── route.ts         ← POST: submit new export
│   │       ├── export/[id]/
│   │       │   └── route.ts         ← GET: export status + details
│   │       ├── exports/
│   │       │   └── route.ts         ← GET: list all exports (paginated)
│   │       ├── feeds/
│   │       │   └── route.ts         ← GET: search feeds from Pyth API
│   │       └── logs/[id]/
│   │           └── route.ts         ← GET: export log file content
│   └── lib/
│       ├── db.ts                    ← SQLite setup, queries, startup sweep
│       ├── export-runner.ts         ← Script spawner + lifecycle management
│       ├── auto-split.ts            ← Batch size calculator
│       └── validate.ts              ← Input sanitization + min_channel check
├── logs/                            ← export log files (gitignored)
└── data/
    └── exports.db                   ← SQLite database (gitignored)
```

---

## Data Model

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS exports (
  id              TEXT PRIMARY KEY,       -- UUID
  client_name     TEXT NOT NULL,          -- "ACME Corp - Jan 2026 Export"
  feed_ids        TEXT NOT NULL,          -- JSON array: [1, 2, 42]
  channel         INTEGER NOT NULL,       -- 1=real-time, 2=50ms, 3=200ms, 4=1000ms
  columns         TEXT NOT NULL,          -- JSON array: ["price","best_bid_price",...]
  start_dt        TEXT NOT NULL,          -- "2026-01-01 00:00:00"
  end_dt          TEXT NOT NULL,          -- "2026-06-30 23:59:59"
  batch_mode      TEXT,                   -- auto-calculated: none|day|minute|month
  batch_days      INTEGER,
  batch_minutes   INTEGER,
  feed_group_size INTEGER DEFAULT 0,      -- 0=all, 1=per feed, N=chunk of N
  status          TEXT NOT NULL DEFAULT 'queued',  -- queued|processing|completed|failed
  s3_url          TEXT,                   -- S3 prefix URL
  s3_manifest     TEXT,                   -- index.html URL
  error_msg       TEXT,                   -- last error or warning
  pid             INTEGER,               -- child process ID
  file_count      INTEGER,               -- number of exported files (parsed from stdout)
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### Status State Machine

```
                    ┌──────────┐
   POST /api/export │  queued  │
   ─────────────────▶          │
                    └────┬─────┘
                         │ spawn()
                         ▼
                    ┌──────────┐
                    │processing│◀─────── CH system.processes confirms alive
                    │          │
                    └──┬───┬───┘
                       │   │
           exit(0)     │   │  exit(!=0) / timeout / server restart
                       ▼   ▼
              ┌──────────┐ ┌──────────┐
              │completed │ │  failed  │
              │          │ │          │
              └──────────┘ └──────────┘

  Transitions:
    queued     → processing   (spawn succeeds)
    queued     → failed       (spawn fails — script not found, etc.)
    processing → completed    (script exits 0, file_count > 0)
    processing → completed    (script exits 0, file_count = 0, with warning)
    processing → failed       (script exits non-zero, stderr captured)
    processing → failed       (24h timeout, process killed)
    processing → failed       (server restart, startup sweep)
    processing → failed       (CH process gone + pid dead)
```

---

## Form Fields

```
┌─────────────────────────────────────────────────────┐
│  New Data Export Request                             │
│                                                     │
│  Client Name / Export Name *                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ e.g. ACME Corp - Jan 2026 Export            │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Search Price Feeds                                 │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🔍 Search by ID, symbol, name, asset type   │    │
│  └─────────────────────────────────────────────┘    │
│  ┌───────┬───────────────┬──────────┬───────────┐   │
│  │  ID   │ Symbol        │ Name     │ Asset Type│   │
│  ├───────┼───────────────┼──────────┼───────────┤   │
│  │ [x] 1 │ Crypto.BTC/USD│ BTCUSD   │ crypto    │   │
│  │ [x] 2 │ Crypto.ETH/USD│ ETHUSD   │ crypto    │   │
│  │ [ ] 3 │ Crypto.PYTH/..│ PYTHUSD  │ crypto    │   │
│  └───────┴───────────────┴──────────┴───────────┘   │
│                                                     │
│  Selected Feed IDs: 1, 2                            │
│                                                     │
│  Channel *                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ ▾ Channel 4 - fixed_rate@1000ms (1s)        │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Columns to Export *                                │
│  [x] price  [x] best_bid_price  [x] best_ask_price │
│  [ ] publisher_count  [ ] confidence                │
│  [ ] market_session                                 │
│                                                     │
│  Start Date & Time *          End Date & Time *     │
│  ┌───────────────────┐        ┌───────────────────┐ │
│  │ 2026-01-01 00:00  │        │ 2026-01-31 23:59  │ │
│  └───────────────────┘        └───────────────────┘ │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Estimated: ~8.6M rows, ~470MB, 31 files     │    │
│  │ Auto-split: per-feed + daily batches         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Cancel]                        [Submit Export]    │
└─────────────────────────────────────────────────────┘
```

---

## Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Pyth Data Exports                                              [New Export] │
├──────────┬──────────┬─────────┬────────────┬──────────┬──────────┬──────────┤
│ Name     │ Feeds    │ Channel │ Date Range │ Status   │ Duration │ Actions  │
├──────────┼──────────┼─────────┼────────────┼──────────┼──────────┼──────────┤
│ ACME Corp│ BTC, ETH │ 200ms   │ Jan-Jun 26 │ ✅ Done  │ 12m 34s  │ [S3][Log]│
│ FundX    │ AAPL     │ 1s      │ Feb 26     │ ⏳ 47%   │ 2m 01s   │ [Log]    │
│ Internal │ 50 feeds │ RT      │ Mar 1-7    │ ❌ Failed│ 0m 12s   │ [Log]    │
│ TestRun  │ BTC      │ 1s      │ Mar 18     │ ✅ Done  │ 0m 45s   │ [S3][Log]│
├──────────┴──────────┴─────────┴────────────┴──────────┴──────────┴──────────┤
│                              < 1  2  3 >                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Split Algorithm

The auto-split calculator determines batch configuration from form inputs,
targeting a maximum of ~500MB per output file.

### Decision Tree

```
autoSplit(channel, numFeeds, rangeSec)
│
├─ Calculate: ratePerSec = CHANNEL_RATES[channel]
│    Channel 1 (real-time):  1000 rows/sec/feed
│    Channel 2 (50ms):         20 rows/sec/feed
│    Channel 3 (200ms):         5 rows/sec/feed
│    Channel 4 (1000ms):        1 row/sec/feed
│
├─ Calculate: rowSizeBytes ≈ 55 (avg CSV row)
├─ Calculate: targetRows = 500MB / 55 ≈ 9,090,909
│
├─ FEED SPLIT DECISION
│   numFeeds > 10?
│   ├─ YES → feedGroupSize = 1 (one subfolder per feed)
│   └─ NO  → feedGroupSize = 0 (all feeds in one file)
│
├─ effectiveFeeds = (feedGroupSize == 1) ? 1 : numFeeds
├─ rowsPerGroup = rangeSec × ratePerSec × effectiveFeeds
│
├─ TIME SPLIT DECISION
│   rowsPerGroup <= targetRows?
│   ├─ YES → batchMode = "none" (single file per feed group)
│   └─ NO  → Try progressively smaller time windows:
│       │
│       ├─ dailyRows = 86400 × ratePerSec × effectiveFeeds
│       │   dailyRows <= targetRows?
│       │   ├─ YES → batchMode = "day", batchDays = 1
│       │   └─ NO  →
│       │       │
│       │       ├─ hourlyRows = 3600 × ratePerSec × effectiveFeeds
│       │       │   hourlyRows <= targetRows?
│       │       │   ├─ YES → batchMode = "minute", batchMinutes = 60
│       │       │   └─ NO  → batchMode = "minute", batchMinutes = 1
│       │       │
│
└─ Return { feedGroupSize, batchMode, batchDays, batchMinutes }
```

### Split Matrix

```
               FEED_GROUP_SIZE
                  0 (all)    1 (per feed)    N (chunks of N)
BATCH_MODE  ┌──────────┬──────────────┬─────────────────┐
  none      │ 1 file   │ 1 per feed   │ 1 per chunk     │
  day       │ 1/day    │ feed × day   │ chunk × day     │
  minute    │ 1/min    │ feed × min   │ chunk × min     │
  month     │ 1/month  │ feed × month │ chunk × month   │
            └──────────┴──────────────┴─────────────────┘
```

### S3 Path Structure

```
s3://pyth-ch-share-public/exports/pyth-dump/
  └── <export_id>/
      ├── index.html                                    ← manifest
      ├── feed=1314/
      │   ├── day=2026-02-18_part000/price_export.csv
      │   ├── day=2026-02-19_part000/price_export.csv
      │   └── ...
      ├── feed=1315/
      │   ├── day=2026-02-18_part000/price_export.csv
      │   └── ...
      └── ...
```

---

## API Routes

### POST /api/export — Submit New Export

```
Request:
  {
    client_name: "ACME Corp - Jan 2026 Export",
    feed_ids: [1, 2, 42],
    channel: 4,
    columns: ["price", "best_bid_price", "best_ask_price"],
    start_dt: "2026-01-01 00:00:00",
    end_dt: "2026-01-31 23:59:59"
  }

Flow:
  1. Validate all inputs (sanitize, min_channel, date format, row estimate)
  2. Check concurrent limit (max 3 processing)
  3. Run autoSplit(channel, feedIds.length, rangeSec) → batch config
  4. Insert SQLite row (status: "queued")
  5. Write temp .env file at /tmp/export_<id>.env
  6. Spawn run_lazer_export_s3.sh --export-id <id> --output export.csv --config /tmp/export_<id>.env
  7. Pipe stdout/stderr → logs/<id>.log
  8. Update SQLite (status: "processing", pid: child.pid)
  9. Return 202 { id, status: "processing", estimated_files, estimated_size }

On child exit(0):
  - Read last 50 lines of log, parse file count
  - finalizeExport(id, "completed")

On child exit(!=0):
  - Read stderr from log
  - finalizeExport(id, "failed", stderrLast500Chars)

On timeout (24h):
  - child.kill("SIGTERM"), wait 30s, SIGKILL if alive
  - finalizeExport(id, "failed", "Export timed out after 24 hours")
```

### GET /api/export/[id] — Export Status

```
Response:
  {
    id, client_name, feed_ids, channel, columns,
    start_dt, end_dt, batch_mode, feed_group_size,
    status, s3_url, s3_manifest, error_msg,
    file_count, created_at, updated_at
  }

For status="processing":
  1. Check if child process alive (kill -0 pid)
  2. Check ClickHouse system.processes for query
  3. If both dead → finalizeExport(id, "failed", "Process died unexpectedly")
  4. If CH check fails → degrade gracefully, return SQLite status as-is
```

### GET /api/exports — List All Exports

```
Query params: ?limit=20&offset=0
Response:
  {
    exports: [...],
    total: 147,
    limit: 20,
    offset: 0
  }

Ordered by created_at DESC.
```

### GET /api/feeds — Search Feeds

```
Query params: ?q=BTC&asset_type=crypto
Source: Fetch from Pyth symbols API, cache in memory 5 min

Response:
  {
    feeds: [
      { pyth_lazer_id: 1, symbol: "Crypto.BTC/USD", name: "BTCUSD",
        asset_type: "crypto", min_channel: 1, ... },
      ...
    ],
    total: 3061
  }
```

### GET /api/logs/[id] — View Export Logs

```
Response:
  {
    id: "abc123",
    log: "Exporting 2026-01-01 -> 2026-01-02\n..."
  }

Reads from logs/<id>.log. Returns 404 if not found.
Cap response at 1MB (tail last N lines if larger).
```

---

## Input Validation (validate.ts)

### Sanitization Rules

All form values are written into a temp .env file for the script. Config
injection is the primary threat — a newline in any value could override
other config variables.

```
Field         | Validation
--------------|--------------------------------------------------
client_name   | Strip \n \r " ' ` $ ( ). Max 200 chars.
              | Alphanumeric + spaces + hyphens + underscores only.
feed_ids      | Each must be a positive integer. Max 500 feeds.
channel       | Must be exactly 1, 2, 3, or 4.
columns       | Each must be in allowed set:
              |   price, best_bid_price, best_ask_price,
              |   publisher_count, confidence, market_session
start_dt      | Must match YYYY-MM-DD HH:MM:SS exactly.
end_dt        | Must match YYYY-MM-DD HH:MM:SS exactly.
              | Must be after start_dt.
```

### Min Channel Validation

```
For each feed_id:
  feed = fetchFeed(feed_id)
  if feed.min_channel > requested_channel:
    reject: "Feed {name} requires minimum channel {min_channel}"
```

### Row Estimate Ceiling

```
MAX_ESTIMATED_ROWS = 50,000,000,000  (50 billion)

estimated = rangeSec × CHANNEL_RATES[channel] × numFeeds
if estimated > MAX_ESTIMATED_ROWS:
  reject: "Export too large (~{estimated} rows). Reduce date range, feeds, or use a slower channel."
```

---

## Export Runner Lifecycle (export-runner.ts)

### Process State Machine

```
spawnExport(id, config)
│
├─ Write /tmp/export_<id>.env from config
│
├─ spawn("bash", ["scripts/run_lazer_export_s3.sh",
│        "--export-id", id,
│        "--output", "export.csv",
│        "--config", "/tmp/export_<id>.env"])
│
├─ child.stdout.pipe(logStream)     ← logs/<id>.log
├─ child.stderr.pipe(logStream)     ← same file
│
├─ Set 24h timeout timer
│   └─ On fire: SIGTERM → wait 30s → SIGKILL → finalizeExport(id, "failed", "timeout")
│
├─ child.on("error")                ← spawn failure (ENOENT etc.)
│   └─ finalizeExport(id, "failed", error.message)
│
├─ child.on("exit", code)
│   ├─ clearTimeout(timer)
│   ├─ logStream.end()
│   ├─ tail = execSync("tail -50 logs/<id>.log")
│   │
│   ├─ code === 0?
│   │   ├─ Parse file count from tail
│   │   ├─ Parse S3 URL prefix from tail
│   │   └─ finalizeExport(id, "completed", warning if 0 files)
│   │
│   └─ code !== 0?
│       ├─ Extract last 500 chars of stderr from log
│       └─ finalizeExport(id, "failed", stderr)
│
└─ Return { pid: child.pid }

finalizeExport(id, status, errorMsg?)
│
├─ UPDATE exports SET status, error_msg, updated_at, file_count, s3_url
├─ Delete /tmp/export_<id>.env
└─ Log: "Export {id} → {status}"
```

---

## Server Initialization (instrumentation.ts)

```ts
// Runs once on Next.js server boot
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDb, markStuckAsFailed } = await import('./lib/db');

    // 1. Create table if not exists + enable WAL mode
    initDb();

    // 2. Mark any "processing" rows as "failed" (server restart recovery)
    const swept = markStuckAsFailed();
    if (swept > 0) {
      console.log(`Startup sweep: marked ${swept} stuck exports as failed`);
    }
  }
}
```

---

## Script Modifications

### run_lazer_export_s3.sh — Changes Required

1. **Add EXPORT_COLUMNS config variable**
   ```bash
   # New in config:
   EXPORT_COLUMNS="price,best_bid_price,best_ask_price"
   # "all" = full payload (price, bid, ask, publisher_count, confidence, market_session)
   ```

2. **Dynamic SELECT based on EXPORT_COLUMNS**
   Build the SQL SELECT clause from the columns list. Always include
   `price_feed_id` and `timestamp`. Conditionally include:
   - `argMax(price, publish_time) AS price`
   - `argMax(best_bid_price, publish_time) AS best_bid_price`
   - `argMax(best_ask_price, publish_time) AS best_ask_price`
   - `argMax(publisher_count, publish_time) AS publisher_count`
   - `argMax(confidence, publish_time) AS confidence`
   - `argMax(market_session, publish_time) AS market_session`

### run_lazer_export_full.py — Changes Required

1. **Add --output flag to argparse**
   ```python
   parser.add_argument('--output', help='Output filename (skips interactive prompt)')
   ```
   If `args.output` is set, use it directly. Otherwise, fall back to `input()` prompt.

---

## Security Model

### Threat Map

```
VECTOR                 | THREAT                          | MITIGATION
-----------------------|---------------------------------|---------------------------
Config injection       | Newlines in form input poison   | Strict sanitization in
  via temp .env        | the .env config file            | validate.ts (reject all
                       |                                 | special chars)
SQL injection          | Feed IDs in ClickHouse SQL      | Validate each as integer
  via PRICE_FEED_IDS   |                                 | before writing to config
S3 path traversal      | "../" in export name writes     | Sanitize client_name to
                       | to unexpected S3 paths          | alphanumeric + hyphens only
ClickHouse abuse       | Huge query crashes CH cluster   | Row estimate ceiling +
                       |                                 | concurrent limit (max 3)
Credential exposure    | CH/S3 secrets in client JS      | Secrets only in API routes
                       |                                 | (server-side), never client
Network exposure       | Public access to internal tool  | Tailscale Serve — only
                       |                                 | reachable from Tailscale
Concurrent flood       | Exhaust CH + server resources   | Max 3 concurrent exports
                       |                                 | (429 on exceeded)
```

### Credential Flow

```
1Password vault
  └─ 'Pyth Lazer Clickhouse Production ReadOnly'
      ├─ host
      ├─ username
      └─ password
          │
          ▼
  .envrc (via `op item get ...`)
    export HOST=...
    export USER=...
    export PASSWORD=...
          │
          ▼ (direnv loads into shell env)
  process.env (Node.js server)
    → Available in API routes only
    → Written to temp .env files for script spawn
    → Temp .env deleted after export completes
```

---

## Error & Rescue Map

```
METHOD/CODEPATH                  | WHAT CAN GO WRONG              | RESCUED? | USER SEES
---------------------------------|--------------------------------|----------|-------------------------
POST /api/export                 | Invalid inputs                 | Y        | 400 + specific message
                                 | Config injection attempt       | Y        | 400 "Invalid input"
                                 | min_channel violation          | Y        | 400 "Feed X min chan is Y"
                                 | Row estimate too large         | Y        | 400 "Export too large"
                                 | Concurrent limit (>3)          | Y        | 429 "Max 3 concurrent"
                                 | SQLite write fails             | Y        | 500 "Database error"
                                 | Temp .env write fails          | Y        | 500 "System error"
                                 | Script not found               | Y        | "Failed" + error in log
---------------------------------|--------------------------------|----------|-------------------------
Script execution                 | CH connection timeout          | Y        | "Failed" + stderr in log
                                 | CH query timeout               | Y        | "Failed" + stderr in log
                                 | S3 write denied                | Y        | "Failed" + stderr in log
                                 | Script hangs forever           | Y (24h)  | "Failed: timed out"
                                 | Exit 0 but 0 rows             | Y        | "Completed" + warning
---------------------------------|--------------------------------|----------|-------------------------
GET /api/export/[id]             | Export ID not found            | Y        | 404
                                 | CH process check fails         | Y        | Degrade to SQLite status
---------------------------------|--------------------------------|----------|-------------------------
GET /api/feeds                   | Pyth API down                  | Y        | 503 "Temporarily unavailable"
                                 | Pyth API returns invalid JSON  | Y        | 503 "Temporarily unavailable"
---------------------------------|--------------------------------|----------|-------------------------
Server restart                   | Stuck "processing" rows        | Y        | Marked "failed" on boot
```

---

## Implementation Order

### Phase 1: Foundation (~2h)

1. Scaffold Next.js app (package.json, next.config.js, tsconfig.json)
2. Copy scripts from data_dump into scripts/
3. Implement `lib/db.ts` (SQLite init, CRUD, startup sweep)
4. Implement `instrumentation.ts`
5. Implement `lib/validate.ts`

### Phase 2: Core Pipeline (~3h)

6. Implement `lib/auto-split.ts`
7. Implement `lib/export-runner.ts` (spawn, lifecycle, log capture)
8. Implement `POST /api/export` route
9. Implement `GET /api/export/[id]` route (with CH process check)
10. Modify `run_lazer_export_s3.sh` to support EXPORT_COLUMNS
11. Add `--output` flag to `run_lazer_export_full.py`

### Phase 3: UI (~2h)

12. Implement `GET /api/feeds` route (Pyth API fetch + cache)
13. Implement `GET /api/exports` route (paginated list)
14. Implement `GET /api/logs/[id]` route
15. Build Dashboard page (page.tsx)
16. Build Export Form page (new/page.tsx)

### Phase 4: Polish (~1h)

17. Double-click protection on submit button
18. Export size estimate display before submit
19. Empty state for dashboard (no exports yet)
20. .gitignore for logs/ and data/
21. .env.example documenting required env vars

---

## Deployment

### Server Requirements

- Node.js 18+
- Python 3
- ClickHouse CLI (`clickhouse client` or `clickhouse-client`)
- direnv + 1Password CLI
- Tailscale

### First Deploy

```bash
# 1. Install dependencies
cd apps/pyth-data-puller
pnpm install

# 2. Load credentials
direnv allow     # loads .envrc with 1Password secrets

# 3. Build
pnpm build

# 4. Start
next start -H 127.0.0.1 -p 3000

# 5. Expose on Tailscale
tailscale serve --bg 3000

# 6. Verify
# From another Tailscale machine:
curl https://data-puller.your-tailnet.ts.net/api/feeds
```

### Process Management

Use PM2 or systemd to keep the Next.js process alive:

```bash
pm2 start npm --name "pyth-data-puller" -- start
pm2 save
pm2 startup
```

### SQLite Backup

```bash
# Daily cron
0 3 * * * sqlite3 /path/to/data/exports.db ".backup /path/to/data/exports.db.bak"
```

---

## NOT in Scope

| Deferred | Rationale |
|---|---|
| Slack/email notification | P2 TODO — dashboard polling works for v1 |
| S3 lifecycle policy | P3 TODO — storage is cheap, revisit later |
| Scheduled/recurring exports | Beyond Retool replacement scope |
| Per-user identity / audit trail | Tailscale provides network-level access |
| Multiple query templates | Start with price data (90% use case) |
| API for programmatic consumers | Web form is sufficient for internal team |
| OHLC / publisher data templates | Can add later as new export types |

---

## TODOs (Deferred)

### TODO 1: Slack Notification on Export Completion
- **What:** POST to a Slack webhook when an export completes or fails.
- **Why:** Long exports (hours) require dashboard polling. Slack ping is better UX.
- **Effort:** S (30 lines — optional webhook URL field on form + POST on finalize)
- **Priority:** P2
- **Depends on:** Core pipeline (Phase 2)

### TODO 2: S3 Lifecycle Policy
- **What:** Auto-delete or glacier-transition S3 objects older than 90 days.
- **Why:** Over time, TB of old CSVs will accumulate.
- **Effort:** S (AWS console config, not code)
- **Priority:** P3
- **Depends on:** Nothing — can be done anytime via AWS console

#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path


def parse_env_file(path: Path) -> dict:
    values = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :]
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] in ("\"", "'") and val[-1] == val[0]:
            val = val[1:-1]
        values[key] = val
    return values


def month_start(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, 1)


def next_month(dt: datetime) -> datetime:
    if dt.month == 12:
        return datetime(dt.year + 1, 1, 1)
    return datetime(dt.year, dt.month + 1, 1)


def build_ranges(start: datetime, end: datetime, mode: str, batch_days: int, batch_minutes: int):
    if end <= start:
        raise ValueError("END_DATETIME must be after START_DATETIME")
    ranges = []
    if mode == "month":
        cur = month_start(start)
        while cur < end:
            seg_start = start if start > cur else cur
            seg_end = end if end < next_month(cur) else next_month(cur)
            label = cur.strftime("%Y-%m")
            ranges.append((seg_start, seg_end, label))
            cur = next_month(cur)
    elif mode == "day":
        if batch_days <= 0:
            raise ValueError("BATCH_DAYS must be > 0")
        cur = start
        i = 0
        while cur < end:
            seg_start = cur
            seg_end = min(cur + timedelta(days=batch_days), end)
            label = seg_start.strftime("%Y-%m-%d") + f"_part{i:03d}"
            ranges.append((seg_start, seg_end, label))
            cur = seg_end
            i += 1
    elif mode == "minute":
        if batch_minutes <= 0:
            raise ValueError("BATCH_MINUTES must be > 0")
        cur = start
        i = 0
        while cur < end:
            seg_start = cur
            seg_end = min(cur + timedelta(minutes=batch_minutes), end)
            label = seg_start.strftime("%Y-%m-%d_%H-%M") + f"_part{i:04d}"
            ranges.append((seg_start, seg_end, label))
            cur = seg_end
            i += 1
    else:
        raise ValueError("BATCH_MODE must be one of: none, month, day, minute")
    return ranges


def find_clickhouse_cmd():
    if shutil.which("clickhouse"):
        return ["clickhouse", "client"]
    if shutil.which("clickhouse-client"):
        return ["clickhouse-client"]
    return None


def run_clickhouse(cmd, query, host, user, password, database, out_path):
    full_cmd = cmd + [
        "--progress", "on",
        "--host", host,
        "--secure",
        "--user", user,
        "--password", password,
        "--database", database,
        "--query", query,
    ]
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        subprocess.run(full_cmd, check=True, stdout=f)


def main():
    parser = argparse.ArgumentParser(description="Export Lazer data with full payload fields.")
    parser.add_argument("--test", action="store_true", help="Test connection and exit")
    parser.add_argument("--config", help="Path to config file", default=None)
    parser.add_argument("--output", help="Output filename (skips interactive prompt)", default=None)
    args, extra = parser.parse_known_args()

    if extra:
        if args.config is None and len(extra) == 1:
            args.config = extra[0]
        else:
            print(f"Unexpected arguments: {' '.join(extra)}", file=sys.stderr)
            sys.exit(1)

    script_dir = Path(__file__).resolve().parent
    exports_dir = script_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    config_path = Path(args.config) if args.config else script_dir / "lazer_config.env"
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    cfg = parse_env_file(config_path)

    required = ["PRICE_FEED_IDS", "START_DATETIME", "END_DATETIME"]
    missing = [k for k in required if k not in cfg or not cfg[k]]
    if missing:
        print(f"Missing in config: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    interval_value = cfg.get("INTERVAL_VALUE", "").strip()
    interval_unit = cfg.get("INTERVAL_UNIT", "").strip()
    interval_seconds = cfg.get("INTERVAL_SECONDS", "").strip()
    if not interval_value:
        if interval_seconds:
            interval_value = interval_seconds
            interval_unit = "second"
        else:
            print("Missing INTERVAL_VALUE (or legacy INTERVAL_SECONDS) in config", file=sys.stderr)
            sys.exit(1)
    if not interval_unit:
        interval_unit = "second"

    unit_norm = interval_unit.lower()
    if unit_norm in ("second", "seconds", "sec", "s"):
        interval_unit_sql = "SECOND"
    elif unit_norm in ("millisecond", "milliseconds", "ms"):
        interval_unit_sql = "MILLISECOND"
    else:
        print(f"Invalid INTERVAL_UNIT: {interval_unit}. Use second or millisecond.", file=sys.stderr)
        sys.exit(1)
    price_feed_ids = cfg["PRICE_FEED_IDS"].replace(" ", "")
    start_dt = cfg["START_DATETIME"]
    end_dt = cfg["END_DATETIME"]

    channel = cfg.get("CHANNEL", "3")
    database = cfg.get("DATABASE", "default")
    output_default = cfg.get("OUTPUT_DEFAULT", "price_export.csv")
    batch_mode = cfg.get("BATCH_MODE", "none")
    batch_days = int(cfg.get("BATCH_DAYS", "1"))
    batch_minutes = int(cfg.get("BATCH_MINUTES", "60"))
    batch_output_mode = cfg.get("BATCH_OUTPUT_MODE", "merge").lower()
    if batch_output_mode not in ("merge", "split"):
        print("Invalid BATCH_OUTPUT_MODE. Use merge or split.", file=sys.stderr)
        sys.exit(1)
    if batch_mode not in ("none", "month", "day", "minute"):
        print("Invalid BATCH_MODE. Use none, month, day, or minute.", file=sys.stderr)
        sys.exit(1)

    host = os.getenv("HOST", "")
    user = os.getenv("USER", "")
    password = os.getenv("PASSWORD", "")

    if not host or not user or not password:
        print("HOST, USER, PASSWORD must be set in environment.", file=sys.stderr)
        sys.exit(1)

    ch_cmd = find_clickhouse_cmd()
    if not ch_cmd:
        print("clickhouse client not found. Install ClickHouse CLI or add to PATH.", file=sys.stderr)
        sys.exit(1)

    if args.test:
        test_query = "SELECT 1;"
        subprocess.run(ch_cmd + [
            "--progress", "on",
            "--host", host,
            "--secure",
            "--user", user,
            "--password", password,
            "--database", database,
            "--query", test_query,
        ], check=True, stdout=subprocess.DEVNULL)
        print("✅ Connection OK")
        return

    if args.output:
        output_name = args.output
    else:
        if batch_mode in ("month", "day", "minute") and batch_output_mode == "split":
            prompt_label = "Output base filename (in exports/)"
        else:
            prompt_label = "Output CSV filename (in exports/)"
        output_name = input(f"{prompt_label} [{output_default}]: ").strip() or output_default
    output_path = exports_dir / output_name

    def build_query(seg_start: datetime, seg_end: datetime) -> str:
        return f"""
WITH
    {interval_value} as interval_value,
    ({price_feed_ids}) as selected_price_feeds
SELECT
    price_feed_id,
    toStartOfInterval(publish_time, INTERVAL interval_value {interval_unit_sql}) AS timestamp,
    argMax(price, publish_time) AS price,
    argMax(best_bid_price, publish_time) AS best_bid_price,
    argMax(best_ask_price, publish_time) AS best_ask_price,
    argMax(publisher_count, publish_time) AS publisher_count,
    argMax(confidence, publish_time) AS confidence,
    argMax(market_session, publish_time) AS market_session
FROM price_feeds
WHERE price_feed_id IN selected_price_feeds
    AND channel = {channel}
    AND publish_time >= toDateTime('{seg_start.strftime('%Y-%m-%d %H:%M:%S')}')
    AND publish_time < toDateTime('{seg_end.strftime('%Y-%m-%d %H:%M:%S')}')
GROUP BY price_feed_id, timestamp
ORDER BY price_feed_id, timestamp
FORMAT CSVWithNames;
""".strip()

    if batch_mode in ("month", "day", "minute"):
        ranges = build_ranges(
            datetime.fromisoformat(start_dt),
            datetime.fromisoformat(end_dt),
            batch_mode,
            batch_days,
            batch_minutes,
        )
        tmp_dir = Path(os.path.abspath(os.path.join(exports_dir, f"tmp_lazer_export_full_{os.getpid()}")))
        tmp_dir.mkdir(parents=True, exist_ok=True)
        print(f"Batching by {batch_mode} into {tmp_dir}")

        files = []
        for seg_start, seg_end, label in ranges:
            out_file = tmp_dir / f"export_{label}.csv"
            print(f"Exporting {seg_start} -> {seg_end}")
            query = build_query(seg_start, seg_end)
            run_clickhouse(ch_cmd, query, host, user, password, database, out_file)
            files.append(out_file)

        if batch_output_mode == "split":
            base_name = output_path.stem
            ext = output_path.suffix.lstrip(".") or "csv"
            split_dir = exports_dir / f"{base_name}_batches"
            split_dir.mkdir(parents=True, exist_ok=True)
            for f in files:
                label = f.stem
                out_file = split_dir / f"{base_name}_{label}.{ext}"
                shutil.copyfile(f, out_file)
            print(f"✅ Exported {len(files)} files to {split_dir}")
            print(f"Temp files kept at {tmp_dir}")
        else:
            # Merge CSVs with single header
            with open(output_path, "w", encoding="utf-8", newline="") as out_f:
                first = True
                for f in files:
                    with open(f, "r", encoding="utf-8", newline="") as in_f:
                        if not first:
                            next(in_f, None)
                        for line in in_f:
                            out_f.write(line)
                    first = False

            print(f"✅ Exported to {output_path}")
            print(f"Temp files kept at {tmp_dir}")
    else:
        query = build_query(datetime.fromisoformat(start_dt), datetime.fromisoformat(end_dt))
        run_clickhouse(ch_cmd, query, host, user, password, database, output_path)
        print(f"✅ Exported to {output_path}")


if __name__ == "__main__":
    main()

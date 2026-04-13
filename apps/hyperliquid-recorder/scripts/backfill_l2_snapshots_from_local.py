#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "clickhouse-connect>=0.8.15",
#   "python-dotenv>=1.0.1",
#   "tqdm>=4.66.5",
#   "zstandard>=0.23.0",
# ]
# ///

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import importlib
import json
import threading
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Protocol

import clickhouse_connect
from dotenv import load_dotenv
import zstandard as zstd

MAX_FILE_RETRIES = 50


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def must_int_env(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got: {value}") from exc


def parse_date(value: str, name: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{name} must use YYYY-MM-DD format, got: {value}") from exc


def natural_key(path: Path) -> list[object]:
    parts = re.split(r"([0-9]+)", path.name)
    key: list[object] = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part)
    return key


@dataclass(frozen=True)
class Config:
    script_dir: Path
    sql_file: Path
    source_dir: Path
    backfill_start_date: date
    backfill_end_date: date
    n_levels: int
    n_sig_figs: int
    mantissa: int
    source_endpoint: str
    ch_host: str
    ch_port: int
    ch_user: str
    ch_password: str
    ch_secure: bool
    ch_database: str
    ch_l2_snapshots_table: str
    backfill_max_parallelism: int


@dataclass(frozen=True)
class DayResult:
    day: date
    emitted_rows: int
    file_count: int
    skipped_reason: str | None = None


class ProgressLike(Protocol):
    def update(self, n: int = 1) -> None: ...

    def __enter__(self) -> "ProgressLike": ...

    def __exit__(self, exc_type, exc, tb) -> None: ...


class NoOpProgress:
    def update(self, n: int = 1) -> None:
        return None

    def __enter__(self) -> "NoOpProgress":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


def load_dotenv_files(script_dir: Path) -> None:
    # Load envs from cwd first, then app-level .env for convenience.
    load_dotenv(override=False)
    app_env_file = script_dir.parent / ".env"
    if app_env_file.exists():
        load_dotenv(dotenv_path=app_env_file, override=False)


def load_config() -> Config:
    script_dir = Path(__file__).resolve().parent
    load_dotenv_files(script_dir)
    sql_file = script_dir.parent / "sql" / "backfill-l2-snapshots.sql"
    source_dir = Path(os.path.expanduser(os.getenv("SOURCE_DIR")))
    start_date = parse_date(os.getenv("BACKFILL_START_DATE", "2026-03-01"), "BACKFILL_START_DATE")
    end_date = parse_date(os.getenv("BACKFILL_END_DATE", "2026-03-29"), "BACKFILL_END_DATE")
    if start_date > end_date:
        raise ValueError("BACKFILL_START_DATE must be <= BACKFILL_END_DATE")
    backfill_max_parallelism = must_int_env("BACKFILL_MAX_PARALLELISM", 8)
    if backfill_max_parallelism < 1:
        raise ValueError("BACKFILL_MAX_PARALLELISM must be >= 1")

    ch_secure = env_bool("CH_SECURE", False)
    ch_port_env = os.getenv("CH_PORT")
    if ch_port_env is None or ch_port_env.strip() == "":
        # clickhouse-connect HTTP defaults differ for secure/non-secure endpoints.
        ch_port = 8443 if ch_secure else 8123
    else:
        try:
            ch_port = int(ch_port_env)
        except ValueError as exc:
            raise ValueError(f"CH_PORT must be an integer, got: {ch_port_env}") from exc

    return Config(
        script_dir=script_dir,
        sql_file=sql_file,
        source_dir=source_dir,
        backfill_start_date=start_date,
        backfill_end_date=end_date,
        n_levels=must_int_env("N_LEVELS", 20),
        n_sig_figs=must_int_env("N_SIG_FIGS", 0),
        mantissa=must_int_env("MANTISSA", 0),
        source_endpoint=os.getenv("SOURCE_ENDPOINT"),
        ch_host=os.getenv("CH_HOST", "localhost"),
        ch_port=ch_port,
        ch_user=os.getenv("CH_USER", "recorder"),
        ch_password=os.getenv("CH_PASSWORD", ""),
        ch_secure=ch_secure,
        ch_database=os.getenv("CH_DATABASE", "pyth_analytics"),
        ch_l2_snapshots_table=os.getenv("CH_L2_SNAPSHOTS_TABLE", "hyperliquid_l2_snapshots"),
        backfill_max_parallelism=backfill_max_parallelism,
    )


def ch_identifier(value: str, name: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"{name} contains invalid ClickHouse identifier: {value}")
    return value


def ch_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def rendered_insert_query(cfg: Config, sql_template: str, day_start: str, day_end: str) -> str:
    query = sql_template
    replacements = {
        "{database:Identifier}": ch_identifier(cfg.ch_database, "CH_DATABASE"),
        "{l2_snapshots_table:Identifier}": ch_identifier(cfg.ch_l2_snapshots_table, "CH_L2_SNAPSHOTS_TABLE"),
        "{day_start:String}": ch_string(day_start),
        "{day_end:String}": ch_string(day_end),
        "{n_levels:UInt16}": str(cfg.n_levels),
        "{n_sig_figs:UInt8}": str(cfg.n_sig_figs),
        "{mantissa:UInt8}": str(cfg.mantissa),
        "{source_endpoint:String}": ch_string(cfg.source_endpoint),
    }
    for placeholder, value in replacements.items():
        query = query.replace(placeholder, value)
    unresolved = re.findall(r"\{[A-Za-z_][A-Za-z0-9_]*:[^}]+\}", query)
    if unresolved:
        raise ValueError(f"query contains unresolved placeholders: {unresolved}")
    return query


def build_transformed_json_rows(file_path: Path) -> tuple[str, int]:
    buffer = io.StringIO()

    emitted = 0
    with file_path.open("rb") as compressed_fh:
        dctx = zstd.ZstdDecompressor()
        with dctx.stream_reader(compressed_fh) as reader:
            text_reader = io.TextIOWrapper(reader, encoding="utf-8")
            for raw in text_reader:
                line = raw.strip()
                if not line:
                    continue
                obj = json.loads(line)
                t = int(obj.get("t"))
                h = int(obj.get("h"))
                books = obj.get("books") or []
                for book in books:
                    levels = book.get("levels") or [[], []]
                    bids = levels[0] if len(levels) > 0 else []
                    asks = levels[1] if len(levels) > 1 else []
                    out = {
                        "coin": book.get("coin"),
                        "t": t,
                        "h": h,
                        "bids_raw": [[lvl.get("px"), lvl.get("sz"), int(lvl.get("n", 0))] for lvl in bids],
                        "asks_raw": [[lvl.get("px"), lvl.get("sz"), int(lvl.get("n", 0))] for lvl in asks],
                    }
                    buffer.write(json.dumps(out, separators=(",", ":")))
                    buffer.write("\n")
                    emitted += 1
    return buffer.getvalue(), emitted


def insert_file_rows(
    client: clickhouse_connect.driver.Client,
    file_path: Path,
    cfg: Config,
    sql_template: str,
    day_start: str,
    day_end: str,
) -> int:
    payload, emitted = build_transformed_json_rows(file_path)
    if emitted == 0:
        return 0
    query = rendered_insert_query(cfg, sql_template, day_start, day_end)
    client.command(query, data=payload)
    return emitted


def iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current = current + timedelta(days=1)


def make_ch_client(cfg: Config) -> clickhouse_connect.driver.Client:
    return clickhouse_connect.get_client(
        host=cfg.ch_host,
        port=cfg.ch_port,
        username=cfg.ch_user,
        password=cfg.ch_password,
        secure=cfg.ch_secure,
        database=cfg.ch_database,
        connect_timeout=60 * 10,
        send_receive_timeout=60 * 10,
    )


def collect_day_files(cfg: Config) -> tuple[dict[date, list[Path]], list[DayResult]]:
    day_files: dict[date, list[Path]] = {}
    skipped: list[DayResult] = []
    for current_day in iter_dates(cfg.backfill_start_date, cfg.backfill_end_date):
        abs_day_dir = cfg.source_dir / current_day.strftime("%Y%m%d")
        if not abs_day_dir.is_dir():
            skipped.append(DayResult(day=current_day, emitted_rows=0, file_count=0, skipped_reason=f"missing {abs_day_dir}"))
            continue
        files_sorted = sorted(abs_day_dir.glob("*.ndjson.zst"), key=natural_key)
        if not files_sorted:
            skipped.append(DayResult(day=current_day, emitted_rows=0, file_count=0, skipped_reason="no files"))
            continue
        day_files[current_day] = files_sorted
    return day_files, skipped


def process_file_with_progress(
    current_day: date,
    file_path: Path,
    cfg: Config,
    sql_template: str,
    progress: ProgressLike,
    progress_lock: threading.Lock,
) -> tuple[date, int]:
    day_after = current_day + timedelta(days=1)
    day_start = f"{current_day.isoformat()} 00:00:00"
    day_end = f"{day_after.isoformat()} 00:00:00"

    try:
        for attempt in range(1, MAX_FILE_RETRIES + 1):
            client = make_ch_client(cfg)
            try:
                emitted_rows = insert_file_rows(client, file_path, cfg, sql_template, day_start, day_end)
                return current_day, emitted_rows
            except Exception as exc:
                if attempt >= MAX_FILE_RETRIES:
                    raise RuntimeError(
                        f"exhausted retries ({MAX_FILE_RETRIES}) for day={current_day.isoformat()} file={file_path.name}"
                    ) from exc
                backoff_seconds = float(attempt)
                print(
                    f"retrying day={current_day.isoformat()} file={file_path.name} "
                    f"attempt={attempt + 1}/{MAX_FILE_RETRIES} after error: {exc}",
                    file=sys.stderr,
                )
                time.sleep(backoff_seconds)
            finally:
                client.close()
    finally:
        with progress_lock:
            progress.update(1)


def build_progress(total_files: int) -> ProgressLike:
    try:
        tqdm_mod = importlib.import_module("tqdm")
    except ModuleNotFoundError:
        return NoOpProgress()
    return tqdm_mod.tqdm(total=total_files, desc="backfill files", unit="file")


def main() -> int:
    try:
        cfg = load_config()
        if not cfg.sql_file.exists():
            raise FileNotFoundError(f"missing SQL file: {cfg.sql_file}")
        if not cfg.source_dir.is_dir():
            raise FileNotFoundError(f"missing SOURCE_DIR: {cfg.source_dir}")
        if os.getenv("USE_DOCKER_EXEC") is not None:
            print("warning: USE_DOCKER_EXEC is ignored when using clickhouse-connect", file=sys.stderr)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sql_template = cfg.sql_file.read_text(encoding="utf-8")

    print("running L2 snapshot backfill")
    print(f"source: {cfg.source_dir}")
    print(f"target: {cfg.ch_database}.{cfg.ch_l2_snapshots_table} via {cfg.ch_host}:{cfg.ch_port}")
    print(f"date range: {cfg.backfill_start_date}..{cfg.backfill_end_date}")
    print(f"levels: n_levels={cfg.n_levels} n_sig_figs={cfg.n_sig_figs} mantissa={cfg.mantissa}")
    print(f"max_parallelism: {cfg.backfill_max_parallelism}")

    day_files, skipped_days = collect_day_files(cfg)
    for skipped in skipped_days:
        print(f"skipping {skipped.day.isoformat()}: {skipped.skipped_reason}", file=sys.stderr)

    file_jobs: list[tuple[date, Path]] = [
        (day, file_path)
        for day, files_sorted in day_files.items()
        for file_path in files_sorted
    ]
    total_files = len(file_jobs)
    print(f"total_files: {total_files}")

    total_emitted = 0
    day_emitted_rows: dict[date, int] = {}
    day_file_counts: dict[date, int] = {}
    for day, files_sorted in day_files.items():
        day_emitted_rows[day] = 0
        day_file_counts[day] = len(files_sorted)

    progress_lock = threading.Lock()
    with build_progress(total_files) as progress:
        with ThreadPoolExecutor(max_workers=cfg.backfill_max_parallelism) as executor:
            futures = {
                executor.submit(
                    process_file_with_progress,
                    day,
                    file_path,
                    cfg,
                    sql_template,
                    progress,
                    progress_lock,
                ): (day, file_path)
                for day, file_path in file_jobs
            }
            for future in as_completed(futures):
                day, file_path = futures[future]
                try:
                    result_day, emitted_rows = future.result()
                except Exception as exc:
                    for pending in futures:
                        pending.cancel()
                    print(f"failed day={day.isoformat()} file={file_path.name}: {exc}", file=sys.stderr)
                    return 1

                total_emitted += emitted_rows
                day_emitted_rows[result_day] += emitted_rows

    for day in sorted(day_file_counts):
        print(
            f"completed day={day.isoformat()} "
            f"files={day_file_counts[day]} emitted_rows={day_emitted_rows[day]}"
        )

    print(f"backfill complete for {cfg.backfill_start_date}..{cfg.backfill_end_date} (emitted_rows={total_emitted})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

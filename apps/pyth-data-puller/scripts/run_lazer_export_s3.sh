#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH=""
TEST_ONLY=0
EXPORT_ID_ARG=""
OUTPUT_NAME_ARG=""
OVERWRITE_FLAG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --test)
      TEST_ONLY=1
      shift
      ;;
    --config)
      shift
      if [[ $# -eq 0 ]]; then
        echo "--config requires a path" >&2
        exit 1
      fi
      CONFIG_PATH="$1"
      shift
      ;;
    --export-id)
      shift
      if [[ $# -eq 0 ]]; then
        echo "--export-id requires a value" >&2
        exit 1
      fi
      EXPORT_ID_ARG="$1"
      shift
      ;;
    --output)
      shift
      if [[ $# -eq 0 ]]; then
        echo "--output requires a value" >&2
        exit 1
      fi
      OUTPUT_NAME_ARG="$1"
      shift
      ;;
    --overwrite)
      OVERWRITE_FLAG=1
      shift
      ;;
    -* )
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      if [[ -z "$CONFIG_PATH" ]]; then
        CONFIG_PATH="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$CONFIG_PATH" ]]; then
  CONFIG_PATH="$SCRIPT_DIR/lazer_config.env"
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config not found: $CONFIG_PATH" >&2
  exit 1
fi

# Load config
set -a
# shellcheck source=/dev/null
source "$CONFIG_PATH"
set +a

# Required config
: "${PRICE_FEED_IDS:?Missing PRICE_FEED_IDS in config}"
: "${START_DATETIME:?Missing START_DATETIME in config}"
: "${END_DATETIME:?Missing END_DATETIME in config}"
: "${S3_BUCKET:?Missing S3_BUCKET in config}"
: "${S3_REGION:?Missing S3_REGION in config}"
: "${S3_PREFIX:?Missing S3_PREFIX in config}"
: "${S3_ROLE_ARN:?Missing S3_ROLE_ARN in config}"

# Optional config
: "${INTERVAL_VALUE:=}"
: "${INTERVAL_UNIT:=}"
: "${INTERVAL_SECONDS:=}"
CHANNEL="${CHANNEL:-1}"
DATABASE="${DATABASE:-default}"
BATCH_MODE="${BATCH_MODE:-none}"
BATCH_DAYS="${BATCH_DAYS:-1}"
BATCH_MINUTES="${BATCH_MINUTES:-60}"
FEED_GROUP_SIZE="${FEED_GROUP_SIZE:-0}"
EXPORT_COLUMNS="${EXPORT_COLUMNS:-all}"
OUTPUT_DEFAULT="${OUTPUT_DEFAULT:-price_export.csv}"
GENERATE_INDEX_HTML="${GENERATE_INDEX_HTML:-1}"
S3_OVERWRITE_ON_INSERT="${S3_OVERWRITE_ON_INSERT:-0}"
INDEX_CONTENT_TYPE="${INDEX_CONTENT_TYPE:-text/html; charset=utf-8}"
INDEX_CONTENT_TYPE_FIX_WITH_AWSCLI="${INDEX_CONTENT_TYPE_FIX_WITH_AWSCLI:-0}"

# Channel-to-interval mapping (Retool validates compatibility and sends CHANNEL)
: "${CHANNEL_REAL_TIME_ID:=1}"
: "${CHANNEL_FIXED_50MS_ID:=2}"
: "${CHANNEL_FIXED_200MS_ID:=3}"
: "${CHANNEL_FIXED_1000MS_ID:=4}"

# ClickHouse env
if [[ -z "${PASSWORD:-}" ]]; then
  echo "PASSWORD is not set in environment. Load credentials via direnv/.envrc first." >&2
  exit 1
fi

if [[ -z "${HOST:-}" || -z "${USER:-}" ]]; then
  echo "HOST and USER must be set in environment. Load credentials via direnv/.envrc first." >&2
  exit 1
fi

# Determine clickhouse client
if command -v clickhouse >/dev/null 2>&1; then
  CH_CMD=(clickhouse client)
elif command -v clickhouse-client >/dev/null 2>&1; then
  CH_CMD=(clickhouse-client)
else
  echo "clickhouse client not found. Install ClickHouse CLI or ensure it's in PATH." >&2
  exit 1
fi

if [[ "$TEST_ONLY" == "1" ]]; then
  "${CH_CMD[@]}" \
    --progress on \
    --host "$HOST" \
    --secure \
    --user "$USER" \
    --password "$PASSWORD" \
    --database "$DATABASE" \
    --query "SELECT 1;" >/dev/null
  echo "✅ Connection OK"
  exit 0
fi

if [[ -z "${INTERVAL_VALUE}" ]]; then
  if [[ -n "${INTERVAL_SECONDS}" ]]; then
    INTERVAL_VALUE="${INTERVAL_SECONDS}"
    INTERVAL_UNIT="second"
  else
    case "${CHANNEL}" in
      "${CHANNEL_REAL_TIME_ID}")
        INTERVAL_VALUE=1
        INTERVAL_UNIT="millisecond"
        ;;
      "${CHANNEL_FIXED_50MS_ID}")
        INTERVAL_VALUE=50
        INTERVAL_UNIT="millisecond"
        ;;
      "${CHANNEL_FIXED_200MS_ID}")
        INTERVAL_VALUE=200
        INTERVAL_UNIT="millisecond"
        ;;
      "${CHANNEL_FIXED_1000MS_ID}")
        INTERVAL_VALUE=1000
        INTERVAL_UNIT="millisecond"
        ;;
      *)
        echo "Missing INTERVAL_VALUE (or legacy INTERVAL_SECONDS) and unknown CHANNEL=${CHANNEL} for interval mapping." >&2
        exit 1
        ;;
    esac
  fi
fi

if [[ -z "${INTERVAL_UNIT}" ]]; then
  INTERVAL_UNIT="second"
fi

case "${INTERVAL_UNIT,,}" in
  second|seconds|sec|s)
    INTERVAL_UNIT_SQL="SECOND"
    ;;
  millisecond|milliseconds|ms)
    INTERVAL_UNIT_SQL="MILLISECOND"
    ;;
  *)
    echo "Invalid INTERVAL_UNIT: ${INTERVAL_UNIT}. Use second or millisecond." >&2
    exit 1
    ;;
esac

PRICE_FEED_IDS_CLEAN="${PRICE_FEED_IDS// /}"

if ! [[ "$FEED_GROUP_SIZE" =~ ^[0-9]+$ ]]; then
  echo "Invalid FEED_GROUP_SIZE: ${FEED_GROUP_SIZE}. Use an integer >= 0." >&2
  exit 1
fi

read -r -a FEED_IDS_ARRAY <<< "${PRICE_FEED_IDS_CLEAN//,/ }"
if [[ ${#FEED_IDS_ARRAY[@]} -eq 0 ]]; then
  echo "PRICE_FEED_IDS produced no feed IDs after parsing." >&2
  exit 1
fi

if [[ "$OVERWRITE_FLAG" == "1" ]]; then
  S3_OVERWRITE_ON_INSERT=1
fi

if [[ "$S3_OVERWRITE_ON_INSERT" != "0" && "$S3_OVERWRITE_ON_INSERT" != "1" ]]; then
  echo "Invalid S3_OVERWRITE_ON_INSERT: ${S3_OVERWRITE_ON_INSERT}. Use 0 or 1." >&2
  exit 1
fi

S3_INSERT_SETTINGS=""
if [[ "$S3_OVERWRITE_ON_INSERT" == "1" ]]; then
  S3_INSERT_SETTINGS="SETTINGS s3_truncate_on_insert = 1"
fi

DEFAULT_EXPORT_ID="export_$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -n "$EXPORT_ID_ARG" ]]; then
  S3_EXPORT_ID="$EXPORT_ID_ARG"
else
  read -r -p "S3 export folder name [${DEFAULT_EXPORT_ID}]: " S3_EXPORT_ID
  S3_EXPORT_ID="${S3_EXPORT_ID:-$DEFAULT_EXPORT_ID}"
fi

if [[ -n "$OUTPUT_NAME_ARG" ]]; then
  OUTPUT_NAME="$OUTPUT_NAME_ARG"
else
  read -r -p "Output CSV filename [${OUTPUT_DEFAULT}]: " OUTPUT_NAME
  OUTPUT_NAME="${OUTPUT_NAME:-$OUTPUT_DEFAULT}"
fi

S3_PREFIX_CLEAN="${S3_PREFIX#/}"
S3_PREFIX_CLEAN="${S3_PREFIX_CLEAN%/}"
PUBLIC_PREFIX="https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/"
INDEX_URL="${PUBLIC_PREFIX}index.html"
INDEX_HEADER_SET_OK=1

declare -a EXPORTED_FILE_KEYS=()

run_clickhouse_query() {
  local query="$1"
  "${CH_CMD[@]}" \
    --progress on \
    --host "$HOST" \
    --secure \
    --user "$USER" \
    --password "$PASSWORD" \
    --database "$DATABASE" \
    --query "$query"
}

build_select_columns() {
  local cols="    price_feed_id,
    toStartOfInterval(publish_time, INTERVAL interval_value ${INTERVAL_UNIT_SQL}) AS timestamp"

  if [[ "$EXPORT_COLUMNS" == "all" ]]; then
    cols="$cols,
    argMax(price, publish_time) AS price,
    argMax(best_bid_price, publish_time) AS best_bid_price,
    argMax(best_ask_price, publish_time) AS best_ask_price,
    argMax(publisher_count, publish_time) AS publisher_count,
    argMax(confidence, publish_time) AS confidence,
    argMax(market_session, publish_time) AS market_session"
  else
    IFS=',' read -ra COL_ARRAY <<< "$EXPORT_COLUMNS"
    for col in "${COL_ARRAY[@]}"; do
      col="$(echo "$col" | xargs)"
      case "$col" in
        price)             cols="$cols,
    argMax(price, publish_time) AS price" ;;
        best_bid_price)    cols="$cols,
    argMax(best_bid_price, publish_time) AS best_bid_price" ;;
        best_ask_price)    cols="$cols,
    argMax(best_ask_price, publish_time) AS best_ask_price" ;;
        publisher_count)   cols="$cols,
    argMax(publisher_count, publish_time) AS publisher_count" ;;
        confidence)        cols="$cols,
    argMax(confidence, publish_time) AS confidence" ;;
        market_session)    cols="$cols,
    argMax(market_session, publish_time) AS market_session" ;;
        *)
          echo "Unknown column: $col" >&2
          exit 1 ;;
      esac
    done
  fi

  echo "$cols"
}

SELECT_COLUMNS="$(build_select_columns)"

run_insert() {
  local start_dt="$1"
  local end_dt="$2"
  local s3_url="$3"
  local feed_ids_csv="$4"
  local query

query=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${s3_url}',
  'CSVWithNames',
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
WITH
    ${INTERVAL_VALUE} as interval_value,
    (${feed_ids_csv}) as selected_price_feeds
SELECT
${SELECT_COLUMNS}
FROM price_feeds
WHERE price_feed_id IN selected_price_feeds
    AND channel = ${CHANNEL}
    AND publish_time >= toDateTime('${start_dt}')
    AND publish_time < toDateTime('${end_dt}')
GROUP BY price_feed_id, timestamp
${S3_INSERT_SETTINGS}
SQL
)

  run_clickhouse_query "$query"
}

declare -a FEED_GROUP_LINES=()
build_feed_groups() {
  if [[ "$FEED_GROUP_SIZE" == "0" ]]; then
    FEED_GROUP_LINES=("ALL|${PRICE_FEED_IDS_CLEAN}")
    return
  fi

  local total="${#FEED_IDS_ARRAY[@]}"
  local idx=0
  while (( idx < total )); do
    local end=$((idx + FEED_GROUP_SIZE))
    if (( end > total )); then
      end=$total
    fi

    local group=("${FEED_IDS_ARRAY[@]:idx:end-idx}")
    local group_csv
    local group_label
    local old_ifs="$IFS"
    IFS=,
    group_csv="${group[*]}"
    if [[ ${#group[@]} -eq 1 ]]; then
      group_label="feed=${group[0]}"
    else
      IFS=_
      group_label="feeds=${group[*]}"
    fi
    IFS="$old_ifs"
    FEED_GROUP_LINES+=("${group_label}|${group_csv}")
    idx=$end
  done
}

write_index_html() {
  if [[ "$GENERATE_INDEX_HTML" != "1" ]]; then
    return 0
  fi
  if [[ ${#EXPORTED_FILE_KEYS[@]} -eq 0 ]]; then
    return 0
  fi

  local keys_file
  keys_file="$(mktemp)"
  printf '%s\n' "${EXPORTED_FILE_KEYS[@]}" > "$keys_file"

  upload_index_html() {
    local index_key="$1"
    local local_html_path="$2"
    local index_url="https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${index_key}"
    local index_b64
    index_b64="$(
      python3 - <<'PY' "$local_html_path"
import base64
from pathlib import Path
import sys

print(base64.b64encode(Path(sys.argv[1]).read_bytes()).decode("ascii"))
PY
    )"

    local query_with_header
    query_with_header=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${index_url}',
  'RawBLOB',
  headers('Content-Type'='${INDEX_CONTENT_TYPE}'),
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
${S3_INSERT_SETTINGS}
SQL
)

    if ! run_clickhouse_query "$query_with_header"; then
      INDEX_HEADER_SET_OK=0
      echo "⚠️ Could not set Content-Type metadata via ClickHouse headers(...) for ${index_key}. Retrying without header."
      local query_plain
      query_plain=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${index_url}',
  'RawBLOB',
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
${S3_INSERT_SETTINGS}
SQL
)
      run_clickhouse_query "$query_plain"

      if [[ "$INDEX_CONTENT_TYPE_FIX_WITH_AWSCLI" == "1" ]]; then
        if command -v aws >/dev/null 2>&1; then
          if aws s3api copy-object \
            --region "$S3_REGION" \
            --bucket "$S3_BUCKET" \
            --copy-source "${S3_BUCKET}/${index_key}" \
            --key "$index_key" \
            --metadata-directive REPLACE \
            --content-type "$INDEX_CONTENT_TYPE" \
            >/dev/null; then
            INDEX_HEADER_SET_OK=1
            echo "✅ Fixed ${index_key} Content-Type via aws s3api copy-object"
          else
            echo "⚠️ aws s3api content-type fix failed for ${index_key}. Browsers may download it."
          fi
        else
          echo "⚠️ aws CLI not found. Cannot apply metadata fix fallback for ${index_key}."
        fi
      fi
    fi
  }

  local index_dir
  index_dir="$(mktemp -d)"
  local manifest_file
  manifest_file="${index_dir}/manifest.tsv"

  if python3 - <<'PY' "$S3_BUCKET" "$S3_REGION" "$keys_file" "$S3_PREFIX_CLEAN" "$S3_EXPORT_ID" "$index_dir" "$manifest_file" "$SCRIPT_DIR/pyth_symbols.json"
from collections import defaultdict
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from urllib.parse import quote
import json
import sys

bucket = sys.argv[1]
region = sys.argv[2]
keys_file = Path(sys.argv[3])
prefix_clean = sys.argv[4].strip("/")
export_id = sys.argv[5]
index_dir = Path(sys.argv[6])
manifest_path = Path(sys.argv[7])
symbols_path = Path(sys.argv[8])

prefix = f"{prefix_clean}/{export_id}/"
keys = [line.strip() for line in keys_file.read_text(encoding="utf-8").splitlines() if line.strip()]
grouped_keys = defaultdict(list)

symbols_by_id = {}
if symbols_path.exists():
    raw = json.loads(symbols_path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        for item in raw:
            pid = item.get("pyth_lazer_id")
            if pid is not None:
                symbols_by_id[str(pid)] = item

def feed_ids_for_group(group_label):
    if group_label.startswith("feed="):
        return [group_label.split("=", 1)[1]]
    if group_label.startswith("feeds="):
        return [part for part in group_label.split("=", 1)[1].split("_") if part]
    return []

def display_symbol(feed_id):
    item = symbols_by_id.get(str(feed_id), {})
    return (
        item.get("symbol")
        or item.get("name")
        or item.get("description")
        or str(feed_id)
    )

for key in keys:
    if not key.startswith(prefix):
        raise SystemExit(f"Key does not match export prefix: {key}")
    relative = key[len(prefix):]
    parts = relative.split("/", 1)
    if len(parts) < 2 or not parts[0].startswith(("feed=", "feeds=")):
        raise SystemExit(1)
    group_label, group_relative = parts
    url = f"https://{bucket}.s3.{region}.amazonaws.com/" + quote(key, safe="/-_.~")
    grouped_keys[group_label].append((group_relative, key, url))

generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
manifest_rows = []

root_rows = []
for group_label in sorted(grouped_keys):
    feed_ids = feed_ids_for_group(group_label)
    symbol_labels = [display_symbol(feed_id) for feed_id in feed_ids]
    symbol_display = ", ".join(symbol_labels) if symbol_labels else group_label
    feed_ids_display = ", ".join(feed_ids) if feed_ids else "n/a"
    rows = []
    group_entries = sorted(grouped_keys[group_label], key=lambda item: item[0])
    for group_relative, key, url in group_entries:
        rows.append(
            "<tr>"
            f"<td>{escape(group_relative)}</td>"
            f"<td>{escape(key)}</td>"
            f"<td><a href=\"{escape(url)}\" target=\"_blank\" rel=\"noopener noreferrer\">download</a></td>"
            "</tr>"
        )

    group_html = (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        f"<title>Pyth Export Index - {escape(symbol_display)}</title>"
        "<style>"
        "body{font-family:Arial,sans-serif;padding:24px;}"
        "table{border-collapse:collapse;width:100%;}"
        "th,td{border:1px solid #ddd;padding:8px;text-align:left;}"
        "th{background:#f5f5f5;}"
        "a{color:#0b57d0;text-decoration:none;}"
        "a:hover{text-decoration:underline;}"
        "</style></head><body>"
        "<p><a href=\"../index.html\">&larr; Back to export index</a></p>"
        f"<h1>{escape(symbol_display)}</h1>"
        f"<p>Generated: {escape(generated)}</p>"
        f"<p>Feed IDs: {escape(feed_ids_display)}</p>"
        f"<p>Folder: {escape(group_label)}</p>"
        f"<p>Total files: {len(group_entries)}</p>"
        "<table><thead><tr><th>Relative Path</th><th>S3 Key</th><th>URL</th></tr></thead><tbody>"
        + "".join(rows) +
        "</tbody></table></body></html>"
    )

    group_dir = index_dir / group_label
    group_dir.mkdir(parents=True, exist_ok=True)
    group_html_path = group_dir / "index.html"
    group_html_path.write_text(group_html, encoding="utf-8")
    manifest_rows.append((f"{prefix}{group_label}/index.html", str(group_html_path)))

    group_index_url = f"https://{bucket}.s3.{region}.amazonaws.com/" + quote(f"{prefix}{group_label}/index.html", safe="/-_.~")
    root_rows.append(
        "<tr>"
        f"<td>{escape(symbol_display)}</td>"
        f"<td>{escape(feed_ids_display)}</td>"
        f"<td>{escape(group_label)}</td>"
        f"<td>{len(group_entries)}</td>"
        f"<td><a href=\"{escape(group_index_url)}\" target=\"_blank\" rel=\"noopener noreferrer\">open index</a></td>"
        "</tr>"
    )

root_html = (
    "<!doctype html><html><head><meta charset=\"utf-8\">"
    "<title>Pyth Export Index</title>"
    "<style>"
    "body{font-family:Arial,sans-serif;padding:24px;}"
    "table{border-collapse:collapse;width:100%;}"
    "th,td{border:1px solid #ddd;padding:8px;text-align:left;}"
    "th{background:#f5f5f5;}"
    "a{color:#0b57d0;text-decoration:none;}"
    "a:hover{text-decoration:underline;}"
    "</style></head><body>"
    "<h1>Pyth Export Index</h1>"
    f"<p>Generated: {escape(generated)}</p>"
    f"<p>Total files: {len(keys)}</p>"
    f"<p>Total groups: {len(grouped_keys)}</p>"
    "<table><thead><tr><th>Symbol</th><th>Feed IDs</th><th>Folder</th><th>Files</th><th>Index</th></tr></thead><tbody>"
    + "".join(root_rows) +
    "</tbody></table></body></html>"
)

root_html_path = index_dir / "index.html"
root_html_path.write_text(root_html, encoding="utf-8")
manifest_rows.append((f"{prefix}index.html", str(root_html_path)))

manifest_path.write_text(
    "".join(f"{target_key}\t{html_path}\n" for target_key, html_path in manifest_rows),
    encoding="utf-8",
)
PY
  then
    while IFS=$'\t' read -r index_key html_path; do
      [[ -z "$index_key" ]] && continue
      upload_index_html "$index_key" "$html_path"
    done < "$manifest_file"
    rm -f "$keys_file"
    rm -rf "$index_dir"
    return 0
  fi

  rm -rf "$index_dir"

  local index_b64
  index_b64="$(
    python3 - <<'PY' "$S3_BUCKET" "$S3_REGION" "$keys_file"
import base64
from datetime import datetime, timezone
from html import escape
from urllib.parse import quote
import sys

bucket = sys.argv[1]
region = sys.argv[2]
keys_file = sys.argv[3]
with open(keys_file, "r", encoding="utf-8") as f:
    keys = [line.strip() for line in f if line.strip()]

rows = []
for key in keys:
    url = f"https://{bucket}.s3.{region}.amazonaws.com/" + quote(key, safe="/-_.~")
    rows.append(
        "<tr>"
        f"<td>{escape(key)}</td>"
        f"<td><a href=\"{escape(url)}\" target=\"_blank\" rel=\"noopener noreferrer\">download</a></td>"
        "</tr>"
    )

generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
html = (
    "<!doctype html><html><head><meta charset=\"utf-8\">"
    "<title>Pyth Export Index</title>"
    "<style>"
    "body{font-family:Arial,sans-serif;padding:24px;}"
    "table{border-collapse:collapse;width:100%;}"
    "th,td{border:1px solid #ddd;padding:8px;text-align:left;}"
    "th{background:#f5f5f5;}"
    "</style></head><body>"
    "<h1>Pyth Export Index</h1>"
    f"<p>Generated: {escape(generated)}</p>"
    f"<p>Total files: {len(keys)}</p>"
    "<table><thead><tr><th>S3 Key</th><th>URL</th></tr></thead><tbody>"
    + "".join(rows) +
    "</tbody></table></body></html>"
)
print(base64.b64encode(html.encode("utf-8")).decode("ascii"))
PY
  )"
  rm -f "$keys_file"

  local query_with_header
  query_with_header=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${INDEX_URL}',
  'RawBLOB',
  headers('Content-Type'='${INDEX_CONTENT_TYPE}'),
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
${S3_INSERT_SETTINGS}
SQL
)

  if ! run_clickhouse_query "$query_with_header"; then
    INDEX_HEADER_SET_OK=0
    echo "⚠️ Could not set Content-Type metadata via ClickHouse headers(...). Retrying index upload without header."
    local query_plain
    query_plain=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${INDEX_URL}',
  'RawBLOB',
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
${S3_INSERT_SETTINGS}
SQL
)
    run_clickhouse_query "$query_plain"

    if [[ "$INDEX_CONTENT_TYPE_FIX_WITH_AWSCLI" == "1" ]]; then
      if command -v aws >/dev/null 2>&1; then
        local index_key
        index_key="${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/index.html"
        if aws s3api copy-object \
          --region "$S3_REGION" \
          --bucket "$S3_BUCKET" \
          --copy-source "${S3_BUCKET}/${index_key}" \
          --key "$index_key" \
          --metadata-directive REPLACE \
          --content-type "$INDEX_CONTENT_TYPE" \
          >/dev/null; then
          INDEX_HEADER_SET_OK=1
          echo "✅ Fixed index.html Content-Type via aws s3api copy-object"
        else
          echo "⚠️ aws s3api content-type fix failed. index.html may download instead of render."
        fi
      else
        echo "⚠️ aws CLI not found. Cannot apply metadata fix fallback."
      fi
    fi
  fi

  rm -f "$keys_file"
}

case "${BATCH_MODE,,}" in
  none|month|day|minute) ;;
  *)
    echo "Invalid BATCH_MODE: ${BATCH_MODE}. Use none, month, day, or minute." >&2
    exit 1
    ;;
esac

build_feed_groups

if [[ "${BATCH_MODE,,}" == "none" ]]; then
  for feed_group_line in "${FEED_GROUP_LINES[@]}"; do
    IFS='|' read -r feed_group_label feed_group_csv <<< "$feed_group_line"
    if [[ "$feed_group_label" == "ALL" ]]; then
      S3_KEY="${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/${OUTPUT_NAME}"
    else
      S3_KEY="${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/${feed_group_label}/${OUTPUT_NAME}"
    fi
    S3_URL="https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${S3_KEY}"
    echo "Exporting ${START_DATETIME} -> ${END_DATETIME} for ${feed_group_label}"
    run_insert "$START_DATETIME" "$END_DATETIME" "$S3_URL" "$feed_group_csv"
    EXPORTED_FILE_KEYS+=("$S3_KEY")
  done
else
  mapfile -t ranges < <(
    python3 - <<'PY' "$START_DATETIME" "$END_DATETIME" "${BATCH_MODE,,}" "$BATCH_DAYS" "$BATCH_MINUTES"
from datetime import datetime, timedelta
import sys

start_raw, end_raw, mode, batch_days_raw, batch_minutes_raw = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
start = datetime.fromisoformat(start_raw)
end = datetime.fromisoformat(end_raw)

if end <= start:
    raise SystemExit("END_DATETIME must be after START_DATETIME")

def month_start(dt):
    return datetime(dt.year, dt.month, 1)

def next_month(dt):
    if dt.month == 12:
        return datetime(dt.year + 1, 1, 1)
    return datetime(dt.year, dt.month + 1, 1)

if mode == "month":
    cur = month_start(start)
    while cur < end:
        seg_start = start if start > cur else cur
        seg_end = end if end < next_month(cur) else next_month(cur)
        label = cur.strftime("%Y-%m")
        print(seg_start.strftime("%Y-%m-%d %H:%M:%S"), seg_end.strftime("%Y-%m-%d %H:%M:%S"), label, sep="|")
        cur = next_month(cur)
elif mode == "day":
    batch_days = int(batch_days_raw)
    if batch_days <= 0:
        raise SystemExit("BATCH_DAYS must be > 0")
    cur = start
    i = 0
    while cur < end:
        seg_start = cur
        seg_end = min(cur + timedelta(days=batch_days), end)
        label = seg_start.strftime("%Y-%m-%d") + f"_part{i:03d}"
        print(seg_start.strftime("%Y-%m-%d %H:%M:%S"), seg_end.strftime("%Y-%m-%d %H:%M:%S"), label, sep="|")
        cur = seg_end
        i += 1
elif mode == "minute":
    batch_minutes = int(batch_minutes_raw)
    if batch_minutes <= 0:
        raise SystemExit("BATCH_MINUTES must be > 0")
    cur = start
    i = 0
    while cur < end:
        seg_start = cur
        seg_end = min(cur + timedelta(minutes=batch_minutes), end)
        label = seg_start.strftime("%Y-%m-%d_%H-%M") + f"_part{i:04d}"
        print(seg_start.strftime("%Y-%m-%d %H:%M:%S"), seg_end.strftime("%Y-%m-%d %H:%M:%S"), label, sep="|")
        cur = seg_end
        i += 1
else:
    raise SystemExit("Unsupported BATCH_MODE")
PY
  )

  if [[ ${#ranges[@]} -eq 0 ]]; then
    echo "No batch ranges generated. Check START_DATETIME/END_DATETIME." >&2
    exit 1
  fi

  count=0
  for range_line in "${ranges[@]}"; do
    IFS='|' read -r batch_start batch_end label <<< "$range_line"
    if [[ "${BATCH_MODE,,}" == "day" ]]; then
      path_part="day=${label}"
    elif [[ "${BATCH_MODE,,}" == "minute" ]]; then
      path_part="minute=${label}"
    else
      path_part="month=${label}"
    fi
    for feed_group_line in "${FEED_GROUP_LINES[@]}"; do
      IFS='|' read -r feed_group_label feed_group_csv <<< "$feed_group_line"
      if [[ "$feed_group_label" == "ALL" ]]; then
        S3_KEY="${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/${path_part}/${OUTPUT_NAME}"
      else
        S3_KEY="${S3_PREFIX_CLEAN}/${S3_EXPORT_ID}/${feed_group_label}/${path_part}/${OUTPUT_NAME}"
      fi
      S3_URL="https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${S3_KEY}"
      echo "Exporting ${batch_start} -> ${batch_end} to ${path_part} for ${feed_group_label}"
      run_insert "$batch_start" "$batch_end" "$S3_URL" "$feed_group_csv"
      EXPORTED_FILE_KEYS+=("$S3_KEY")
      count=$((count + 1))
    done
  done

  echo "Exported ${count} batch file(s)."
fi

write_index_html

echo "✅ Exported to S3"
echo "Prefix: $PUBLIC_PREFIX"
if [[ "$GENERATE_INDEX_HTML" == "1" ]]; then
  if [[ "$INDEX_HEADER_SET_OK" == "1" ]]; then
    echo "Index: $INDEX_URL"
  else
    echo "Index: $INDEX_URL"
    echo "⚠️ index.html Content-Type is not text/html; browsers may download it."
  fi
fi

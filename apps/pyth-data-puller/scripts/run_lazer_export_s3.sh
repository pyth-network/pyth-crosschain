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

# Metadata for index.html (passed from web app)
EXPORT_NAME="${EXPORT_NAME:-}"
EXPORT_CHANNEL_LABEL="${EXPORT_CHANNEL_LABEL:-}"
EXPORT_FEED_LABELS="${EXPORT_FEED_LABELS:-}"

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
    argMax(ema_price, publish_time) AS ema_price,
    argMax(ema_confidence, publish_time) AS ema_confidence,
    argMax(confidence, publish_time) AS confidence,
    argMax(publisher_count, publish_time) AS publisher_count,
    argMax(exponent, publish_time) AS exponent,
    argMax(market_session, publish_time) AS market_session,
    argMax(state, publish_time) AS state,
    argMax(funding_rate, publish_time) AS funding_rate,
    argMax(funding_timestamp, publish_time) AS funding_timestamp,
    argMax(funding_rate_interval_us, publish_time) AS funding_rate_interval_us"
  else
    IFS=',' read -ra COL_ARRAY <<< "$EXPORT_COLUMNS"
    for col in "${COL_ARRAY[@]}"; do
      col="$(echo "$col" | xargs)"
      case "$col" in
        price)                     cols="$cols,
    argMax(price, publish_time) AS price" ;;
        best_bid_price)            cols="$cols,
    argMax(best_bid_price, publish_time) AS best_bid_price" ;;
        best_ask_price)            cols="$cols,
    argMax(best_ask_price, publish_time) AS best_ask_price" ;;
        ema_price)                 cols="$cols,
    argMax(ema_price, publish_time) AS ema_price" ;;
        ema_confidence)            cols="$cols,
    argMax(ema_confidence, publish_time) AS ema_confidence" ;;
        confidence)                cols="$cols,
    argMax(confidence, publish_time) AS confidence" ;;
        publisher_count)           cols="$cols,
    argMax(publisher_count, publish_time) AS publisher_count" ;;
        exponent)                  cols="$cols,
    argMax(exponent, publish_time) AS exponent" ;;
        market_session)            cols="$cols,
    argMax(market_session, publish_time) AS market_session" ;;
        state)                     cols="$cols,
    argMax(state, publish_time) AS state" ;;
        funding_rate)              cols="$cols,
    argMax(funding_rate, publish_time) AS funding_rate" ;;
        funding_timestamp)         cols="$cols,
    argMax(funding_timestamp, publish_time) AS funding_timestamp" ;;
        funding_rate_interval_us)  cols="$cols,
    argMax(funding_rate_interval_us, publish_time) AS funding_rate_interval_us" ;;
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
ORDER BY price_feed_id, timestamp
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

  # Generate a single root-level index.html listing all exported files
  local index_b64
  index_b64="$(
    python3 - <<'PY' "$S3_BUCKET" "$S3_REGION" "$keys_file" "$EXPORT_NAME" "$EXPORT_CHANNEL_LABEL" "$EXPORT_FEED_LABELS" "$START_DATETIME" "$END_DATETIME"
import base64
from datetime import datetime, timezone
from html import escape
from urllib.parse import quote
import sys

bucket = sys.argv[1]
region = sys.argv[2]
keys_file = sys.argv[3]
export_name = sys.argv[4] or "Pyth Data Export"
channel_label = sys.argv[5] or "N/A"
feed_labels = sys.argv[6] or "N/A"
start_dt = sys.argv[7] or "N/A"
end_dt = sys.argv[8] or "N/A"

with open(keys_file, "r", encoding="utf-8") as f:
    keys = [line.strip() for line in f if line.strip()]

rows = []
for i, key in enumerate(keys, 1):
    fname = key.rsplit("/", 1)[-1] if "/" in key else key
    url = f"https://{bucket}.s3.{region}.amazonaws.com/" + quote(key, safe="/-_.~")
    rows.append(
        "<tr>"
        f"<td>{i}</td>"
        f"<td>{escape(fname)}</td>"
        f"<td style=\"font-size:12px;color:#666\">{escape(key)}</td>"
        f"<td><a href=\"{escape(url)}\" target=\"_blank\" rel=\"noopener noreferrer\">Download</a></td>"
        "</tr>"
    )

generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

html = (
    "<!doctype html><html><head><meta charset=\"utf-8\">"
    f"<title>{escape(export_name)} - Pyth Data Export</title>"
    "<style>"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:32px 40px;color:#1a1a1a;max-width:1200px;margin:0 auto;}"
    "h1{font-size:28px;margin-bottom:8px;}"
    ".subtitle{color:#666;font-size:14px;margin-bottom:24px;}"
    ".meta{background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin-bottom:24px;}"
    ".meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;}"
    ".meta-item{font-size:14px;}"
    ".meta-label{font-weight:600;color:#495057;}"
    ".meta-value{color:#212529;}"
    "table{border-collapse:collapse;width:100%;margin-top:16px;}"
    "th{background:#f1f3f5;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;}"
    "th,td{border:1px solid #dee2e6;padding:10px 12px;text-align:left;}"
    "tr:nth-child(even){background:#f8f9fa;}"
    "a{color:#0066cc;text-decoration:none;font-weight:500;}"
    "a:hover{text-decoration:underline;}"
    ".footer{margin-top:24px;padding-top:16px;border-top:1px solid #e9ecef;font-size:12px;color:#999;}"
    "</style></head><body>"
    f"<h1>{escape(export_name)}</h1>"
    "<p class=\"subtitle\">Pyth Lazer Historical Price Data Export</p>"
    "<div class=\"meta\"><div class=\"meta-grid\">"
    f"<div class=\"meta-item\"><span class=\"meta-label\">Price Feeds:</span><br><span class=\"meta-value\">{escape(feed_labels)}</span></div>"
    f"<div class=\"meta-item\"><span class=\"meta-label\">Channel:</span><br><span class=\"meta-value\">{escape(channel_label)}</span></div>"
    f"<div class=\"meta-item\"><span class=\"meta-label\">Date Range (UTC):</span><br><span class=\"meta-value\">{escape(start_dt)} &rarr; {escape(end_dt)}</span></div>"
    f"<div class=\"meta-item\"><span class=\"meta-label\">Total Files:</span><br><span class=\"meta-value\">{len(keys)}</span></div>"
    "</div></div>"
    "<table><thead><tr><th>#</th><th>File</th><th>S3 Key</th><th>Download</th></tr></thead><tbody>"
    + "".join(rows)
    + "</tbody></table>"
    f"<div class=\"footer\">Generated: {escape(generated)} &bull; <a href=\"https://pyth.network\">pyth.network</a></div>"
    "</body></html>"
)
print(base64.b64encode(html.encode("utf-8")).decode("ascii"))
PY
  )"
  rm -f "$keys_file"

  # Always use s3_truncate_on_insert=1 for index.html to skip the
  # HeadObject existence check (which fails with 403 when the IAM role
  # only has PutObject permission).
  local query_with_header
  query_with_header=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${INDEX_URL}',
  'RawBLOB',
  headers('Content-Type'='${INDEX_CONTENT_TYPE}'),
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
SETTINGS s3_truncate_on_insert = 1
SQL
)

  if ! run_clickhouse_query "$query_with_header"; then
    INDEX_HEADER_SET_OK=0
    echo "⚠️ Could not set Content-Type via headers(...). Retrying without header."
    local query_plain
    query_plain=$(cat <<SQL
INSERT INTO FUNCTION s3(
  '${INDEX_URL}',
  'RawBLOB',
  extra_credentials(role_arn = '${S3_ROLE_ARN}')
)
SELECT base64Decode('${index_b64}')
SETTINGS s3_truncate_on_insert = 1
SQL
)
    if ! run_clickhouse_query "$query_plain"; then
      echo "⚠️ index.html upload failed. CSV exports completed successfully."
    fi

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

  echo "Exported ${#EXPORTED_FILE_KEYS[@]} file(s)."
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

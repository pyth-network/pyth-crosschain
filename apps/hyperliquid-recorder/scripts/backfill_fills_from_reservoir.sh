#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/../sql/backfill-fills.sql"

AWS_PROFILE_NAME="${AWS_PROFILE_NAME}"
DEFAULT_S3_URL_TEMPLATE="https://hydromancer-reservoir.s3.ap-northeast-1.amazonaws.com/by_dex/xyz/fills/perp/all/date={date}/fills.parquet"
S3_URL_TEMPLATE="${S3_URL_TEMPLATE:-${DEFAULT_S3_URL_TEMPLATE}}"
BACKFILL_START_DATE="${BACKFILL_START_DATE:-2026-03-01}"
BACKFILL_END_DATE="${BACKFILL_END_DATE:-2026-03-31}"

CH_HOST="${CH_HOST:-localhost}"
CH_PORT="${CH_PORT:-9440}"
CH_USER="${CH_USER:-recorder}"
CH_PASSWORD="${CH_PASSWORD:-recorder}"
CH_SECURE="${CH_SECURE:-true}"
CH_DATABASE="${CH_DATABASE:-default}"
CH_TRADES_TABLE="${CH_TRADES_TABLE:-hyperliquid_trades}"
CLICKHOUSE_CONTAINER_NAME="${CLICKHOUSE_CONTAINER_NAME:-hyperliquid-recorder-clickhouse-local}"
USE_DOCKER_EXEC="${USE_DOCKER_EXEC:-false}"
CH_CLIENT_CONFIG_FILE="${CH_CLIENT_CONFIG_FILE:-}"
AUTO_MINIMAL_CH_CONFIG="${AUTO_MINIMAL_CH_CONFIG:-true}"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "missing SQL file: ${SQL_FILE}" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

if [[ "${USE_DOCKER_EXEC}" != "true" ]] && ! command -v clickhouse-client >/dev/null 2>&1; then
  echo "clickhouse-client is required when USE_DOCKER_EXEC is not true" >&2
  exit 1
fi

TEMP_CH_CONFIG_FILE=""
if [[ "${USE_DOCKER_EXEC}" != "true" ]]; then
  if [[ -n "${CH_CLIENT_CONFIG_FILE}" ]]; then
    if [[ ! -f "${CH_CLIENT_CONFIG_FILE}" ]]; then
      echo "CH_CLIENT_CONFIG_FILE does not exist: ${CH_CLIENT_CONFIG_FILE}" >&2
      exit 1
    fi
  elif [[ "${AUTO_MINIMAL_CH_CONFIG}" == "true" ]]; then
    TEMP_CH_CONFIG_FILE="$(mktemp)"
    printf '%s\n' '<clickhouse></clickhouse>' > "${TEMP_CH_CONFIG_FILE}"
    CH_CLIENT_CONFIG_FILE="${TEMP_CH_CONFIG_FILE}"
  fi
fi

cleanup() {
  if [[ -n "${TEMP_CH_CONFIG_FILE}" && -f "${TEMP_CH_CONFIG_FILE}" ]]; then
    rm -f "${TEMP_CH_CONFIG_FILE}"
  fi
}
trap cleanup EXIT

CRED_JSON="$(aws configure export-credentials --profile "${AWS_PROFILE_NAME}" --format process 2>/dev/null || true)"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_SESSION_TOKEN=""

if [[ -n "${CRED_JSON}" ]]; then
  AWS_ACCESS_KEY_ID="$(
    python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('AccessKeyId',''))" <<< "${CRED_JSON}"
  )"
  AWS_SECRET_ACCESS_KEY="$(
    python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('SecretAccessKey',''))" <<< "${CRED_JSON}"
  )"
  AWS_SESSION_TOKEN="$(
    python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('SessionToken',''))" <<< "${CRED_JSON}"
  )"
else
  AWS_ACCESS_KEY_ID="$(aws configure get aws_access_key_id --profile "${AWS_PROFILE_NAME}" || true)"
  AWS_SECRET_ACCESS_KEY="$(aws configure get aws_secret_access_key --profile "${AWS_PROFILE_NAME}" || true)"
fi

if [[ -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "could not resolve AWS credentials from profile ${AWS_PROFILE_NAME}" >&2
  echo "ensure 'aws configure export-credentials --profile ${AWS_PROFILE_NAME} --format process' works" >&2
  exit 1
fi

if [[ "${USE_DOCKER_EXEC}" != "true" && "${CH_PORT}" == "8443" ]]; then
  echo "CH_PORT=8443 is ClickHouse HTTP(S), but clickhouse-client uses native protocol." >&2
  echo "For ClickHouse Cloud with clickhouse-client, use CH_PORT=9440 and CH_SECURE=true." >&2
  exit 1
fi

echo "running Trade[XYZ] March 2026 backfill"
echo "target: ${CH_HOST}:${CH_PORT} ${CH_DATABASE}.${CH_TRADES_TABLE}"
echo "date range: ${BACKFILL_START_DATE}..${BACKFILL_END_DATE}"
template_normalized="${S3_URL_TEMPLATE}"
if ! python3 -c "import re,sys; tpl=sys.argv[1]; sys.exit(0 if re.match(r'^https://.*/date=\\{date\\}/fills\\.parquet$', tpl) else 1)" "${template_normalized}"; then
  echo "warning: invalid S3_URL_TEMPLATE, falling back to default template" >&2
  echo "provided: ${S3_URL_TEMPLATE}" >&2
  template_normalized="${DEFAULT_S3_URL_TEMPLATE}"
fi
echo "s3 template: ${template_normalized}"

next_day() {
  python3 -c "from datetime import datetime, timedelta; d=datetime.strptime('${1}','%Y-%m-%d').date(); print((d + timedelta(days=1)).isoformat())"
}

run_clickhouse_query_for_day() {
  local s3_url="$1"
  local day_start="$2"
  local day_end="$3"

  if [[ "${USE_DOCKER_EXEC}" == "true" ]]; then
    docker exec -i "${CLICKHOUSE_CONTAINER_NAME}" clickhouse-client \
      --user "${CH_USER}" \
      --password "${CH_PASSWORD}" \
      --multiquery \
      --param_database="${CH_DATABASE}" \
      --param_trades_table="${CH_TRADES_TABLE}" \
      --param_s3_url="${s3_url}" \
      --param_day_start="${day_start}" \
      --param_day_end="${day_end}" \
      --param_aws_access_key_id="${AWS_ACCESS_KEY_ID}" \
      --param_aws_secret_access_key="${AWS_SECRET_ACCESS_KEY}" \
      --param_aws_session_token="${AWS_SESSION_TOKEN}" \
      < "${SQL_FILE}"
  else
    local secure_flag="--no-secure"
    if [[ "${CH_SECURE}" == "true" ]]; then
      secure_flag="--secure"
    fi
    local config_args=()
    if [[ -n "${CH_CLIENT_CONFIG_FILE}" ]]; then
      config_args+=(--config-file "${CH_CLIENT_CONFIG_FILE}")
    fi

    clickhouse-client \
      "${config_args[@]}" \
      --host "${CH_HOST}" \
      --port "${CH_PORT}" \
      --user "${CH_USER}" \
      --password "${CH_PASSWORD}" \
      "${secure_flag}" \
      --multiquery \
      --param_database="${CH_DATABASE}" \
      --param_trades_table="${CH_TRADES_TABLE}" \
      --param_s3_url="${s3_url}" \
      --param_day_start="${day_start}" \
      --param_day_end="${day_end}" \
      --param_aws_access_key_id="${AWS_ACCESS_KEY_ID}" \
      --param_aws_secret_access_key="${AWS_SECRET_ACCESS_KEY}" \
      --param_aws_session_token="${AWS_SESSION_TOKEN}" \
      < "${SQL_FILE}"
  fi
}

current_date="${BACKFILL_START_DATE}"
while [[ "${current_date}" < "${BACKFILL_END_DATE}" || "${current_date}" == "${BACKFILL_END_DATE}" ]]; do
  day_after="$(next_day "${current_date}")"
  day_start="${current_date} 00:00:00"
  day_end="${day_after} 00:00:00"
  s3_url="${template_normalized//\{date\}/${current_date}}"

  echo "processing ${current_date} source=${s3_url}"
  run_clickhouse_query_for_day "${s3_url}" "${day_start}" "${day_end}"
  echo "completed ${current_date}"

  current_date="${day_after}"
done

echo "backfill query completed for range ${BACKFILL_START_DATE}..${BACKFILL_END_DATE}"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/../sql/backfill-tradexyz-march-2026.sql"

AWS_PROFILE_NAME="${AWS_PROFILE_NAME:-DouroClickhouseS3Admin-084828603540}"
S3_URL="${S3_URL:-https://hydromancer-reservoir.s3.ap-northeast-1.amazonaws.com/by_dex/xyz/fills/perp/all/date=2026-03-*/fills.parquet}"

CH_HOST="${CH_HOST:-localhost}"
CH_PORT="${CH_PORT:-9100}"
CH_USER="${CH_USER:-recorder}"
CH_PASSWORD="${CH_PASSWORD:-recorder}"
CH_DATABASE="${CH_DATABASE:-pyth_analytics}"
CH_TRADES_TABLE="${CH_TRADES_TABLE:-hyperliquid_trades}"
CLICKHOUSE_CONTAINER_NAME="${CLICKHOUSE_CONTAINER_NAME:-hyperliquid-recorder-clickhouse-local}"
USE_DOCKER_EXEC="${USE_DOCKER_EXEC:-true}"

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

echo "running Trade[XYZ] March 2026 backfill"
echo "target: ${CH_HOST}:${CH_PORT} ${CH_DATABASE}.${CH_TRADES_TABLE}"
echo "source: ${S3_URL}"

if [[ "${USE_DOCKER_EXEC}" == "true" ]]; then
  docker exec -i "${CLICKHOUSE_CONTAINER_NAME}" clickhouse-client \
    --user "${CH_USER}" \
    --password "${CH_PASSWORD}" \
    --multiquery \
    --param_database="${CH_DATABASE}" \
    --param_trades_table="${CH_TRADES_TABLE}" \
    --param_s3_url="${S3_URL}" \
    --param_aws_access_key_id="${AWS_ACCESS_KEY_ID}" \
    --param_aws_secret_access_key="${AWS_SECRET_ACCESS_KEY}" \
    --param_aws_session_token="${AWS_SESSION_TOKEN}" \
    < "${SQL_FILE}"
else
  clickhouse-client \
    --host "${CH_HOST}" \
    --port "${CH_PORT}" \
    --user "${CH_USER}" \
    --password "${CH_PASSWORD}" \
    --multiquery \
    --param_database="${CH_DATABASE}" \
    --param_trades_table="${CH_TRADES_TABLE}" \
    --param_s3_url="${S3_URL}" \
    --param_aws_access_key_id="${AWS_ACCESS_KEY_ID}" \
    --param_aws_secret_access_key="${AWS_SECRET_ACCESS_KEY}" \
    --param_aws_session_token="${AWS_SESSION_TOKEN}" \
    < "${SQL_FILE}"
fi

echo "backfill query completed"

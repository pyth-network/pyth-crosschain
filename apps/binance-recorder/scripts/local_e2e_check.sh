#!/usr/bin/env bash
set -euo pipefail

container_name="${CLICKHOUSE_CONTAINER_NAME:-binance-recorder-clickhouse-local}"
user_name="${CLICKHOUSE_USER:-${CLICKHOUSE_LOCAL_USER:-recorder}}"
password="${CLICKHOUSE_PASSWORD:-${CLICKHOUSE_LOCAL_PASSWORD:-recorder}}"
database_name="${CLICKHOUSE_DATABASE:-pyth_analytics}"
table_name="${CLICKHOUSE_TABLE:-binance_book_ticker}"

# Host ports the recorder publishes (see docker-compose.local.yml).
health_url="${HEALTH_URL:-http://localhost:8084/ready}"
metrics_url="${METRICS_URL:-http://localhost:9094/metrics}"

# 1. Persisted rows.
query="SELECT count() FROM ${database_name}.${table_name}"
count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

echo "local_e2e_check: table=${database_name}.${table_name} rows=${count}"
if [[ "${count}" -le 0 ]]; then
  echo "local_e2e_check: no rows found yet; ensure the recorder is connected and the configured symbols are listed on Binance spot."
  exit 1
fi

# 2. Readiness endpoint responds 200.
ready_status="$(curl -s -o /dev/null -w '%{http_code}' "${health_url}")"
echo "local_e2e_check: GET ${health_url} -> ${ready_status}"
if [[ "${ready_status}" != "200" ]]; then
  echo "local_e2e_check: /ready did not return 200."
  exit 1
fi

# 3. Metrics endpoint exposes the recorder metrics.
if ! curl -sf "${metrics_url}" | grep -q "binance_recorder_"; then
  echo "local_e2e_check: ${metrics_url} did not expose binance_recorder_* metrics."
  exit 1
fi
echo "local_e2e_check: GET ${metrics_url} -> exposing binance_recorder_* metrics"

echo "local_e2e_check: OK"

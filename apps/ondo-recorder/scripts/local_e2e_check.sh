#!/usr/bin/env bash
set -euo pipefail

container_name="${CLICKHOUSE_CONTAINER_NAME:-ondo-recorder-clickhouse-local}"
user_name="${CLICKHOUSE_USER:-${CLICKHOUSE_LOCAL_USER:-recorder}}"
password="${CLICKHOUSE_PASSWORD:-${CLICKHOUSE_LOCAL_PASSWORD:-recorder}}"
database_name="${CLICKHOUSE_DATABASE:-pyth_analytics}"
table_name="${CLICKHOUSE_TABLE:-ondo_quotes}"

query="SELECT count() FROM ${database_name}.${table_name}"
count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

echo "local_e2e_check: table=${database_name}.${table_name} rows=${count}"
if [[ "${count}" -le 0 ]]; then
  echo "local_e2e_check: no rows found yet; ensure API key and token config are correct."
  exit 1
fi

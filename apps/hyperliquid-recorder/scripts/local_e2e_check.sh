#!/usr/bin/env bash
set -euo pipefail

container_name="${CLICKHOUSE_CONTAINER_NAME:-hyperliquid-recorder-clickhouse-local}"
user_name="${CLICKHOUSE_USER:-${CLICKHOUSE_LOCAL_USER:-recorder}}"
password="${CLICKHOUSE_PASSWORD:-${CLICKHOUSE_LOCAL_PASSWORD:-recorder}}"
database_name="${CLICKHOUSE_DATABASE:-pyth_analytics}"
tables="${CLICKHOUSE_TABLES:-hyperliquid_l2_snapshots hyperliquid_funding_rates}"

failed=0
for table_name in ${tables}; do
  query="SELECT count() FROM ${database_name}.${table_name}"
  count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

  echo "local_e2e_check: table=${database_name}.${table_name} rows=${count}"
  if [[ "${count}" -le 0 ]]; then
    echo "local_e2e_check: no rows found in ${database_name}.${table_name} yet; ensure stream auth/market config is correct."
    failed=1
  fi
done

if [[ "${failed}" -ne 0 ]]; then
  exit 1
fi

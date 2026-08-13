#!/usr/bin/env bash
set -euo pipefail

# End-to-end check for the local Tilt stack: asserts rows have landed in
# ClickHouse for every lane (ToB, trades, funding) and the health/metrics
# endpoints respond.

container_name="${CLICKHOUSE_CONTAINER_NAME:-okx-recorder-clickhouse-local}"
user_name="${CLICKHOUSE_USER:-${CLICKHOUSE_LOCAL_USER:-recorder}}"
password="${CLICKHOUSE_PASSWORD:-${CLICKHOUSE_LOCAL_PASSWORD:-recorder}}"
database_name="${CLICKHOUSE_DATABASE:-default}"
book_ticker_table="${CLICKHOUSE_BOOK_TICKER_TABLE:-okx_book_ticker}"
trades_table="${CLICKHOUSE_TRADES_TABLE:-okx_trades}"
funding_rates_table="${CLICKHOUSE_FUNDING_RATES_TABLE:-okx_funding_rates}"

# Host ports the recorder publishes (see docker-compose.local.yml).
health_url="${HEALTH_URL:-http://localhost:8085/ready}"
metrics_url="${METRICS_URL:-http://localhost:9095/metrics}"

# 1. Persisted ToB rows.
query="SELECT count() FROM ${database_name}.${book_ticker_table}"
count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

echo "local_e2e_check: table=${database_name}.${book_ticker_table} rows=${count}"
if [[ "${count}" -le 0 ]]; then
  echo "local_e2e_check: no rows found yet; ensure the recorder is connected and the configured instruments are listed on OKX."
  exit 1
fi

# 2. Persisted trade rows. Trades on a thin perp can be sparse — this check
#    needs at least one print to have landed since the recorder started, so on
#    a quiet market let the stack run longer and re-run the check. (Trade
#    sparseness never fails /ready below; it only fails this row-count assert.)
query="SELECT count() FROM ${database_name}.${trades_table}"
trade_count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

echo "local_e2e_check: table=${database_name}.${trades_table} rows=${trade_count}"
if [[ "${trade_count}" -le 0 ]]; then
  echo "local_e2e_check: no trade rows found yet; on a thin instrument wait for a trade to print and re-run."
  exit 1
fi

# 3. Persisted settled-funding rows. The funding poller fires immediately at
#    startup and re-fetches the trailing history window, so rows should land
#    within seconds even though funding itself settles on an hours-scale
#    cadence. Also assert idempotence: after ReplacingMergeTree collapse
#    (FINAL), no (inst_id, funding_time) pair may appear twice, no matter how
#    many overlapping polls have run.
query="SELECT count() FROM ${database_name}.${funding_rates_table}"
count="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"

echo "local_e2e_check: table=${database_name}.${funding_rates_table} rows=${count}"
if [[ "${count}" -le 0 ]]; then
  echo "local_e2e_check: no funding rows found yet; ensure the recorder is up and the configured instruments are listed on OKX (the first poll runs at startup). Note: a brand-new pre-launch perp legitimately has no settled funding history yet, so zero rows for such an instrument is expected."
  exit 1
fi

query="SELECT count() FROM (SELECT inst_id, funding_time FROM ${database_name}.${funding_rates_table} FINAL GROUP BY inst_id, funding_time HAVING count() > 1)"
dupes="$(docker exec "${container_name}" clickhouse-client --user "${user_name}" --password "${password}" -q "${query}")"
if [[ "${dupes}" -ne 0 ]]; then
  echo "local_e2e_check: found ${dupes} duplicated (inst_id, funding_time) pairs after FINAL; funding inserts are not idempotent."
  exit 1
fi
echo "local_e2e_check: funding rows are unique by (inst_id, funding_time) after FINAL"

# 4. Readiness endpoint responds 200 (ClickHouse reachable + every instrument's
#    ToB lane fresh).
ready_status="$(curl -s -o /dev/null -w '%{http_code}' "${health_url}")"
echo "local_e2e_check: GET ${health_url} -> ${ready_status}"
if [[ "${ready_status}" != "200" ]]; then
  echo "local_e2e_check: /ready did not return 200."
  exit 1
fi

# 5. Metrics endpoint exposes the recorder metrics, including the funding
#    lane's poll counter and last-event gauge (present once the startup poll
#    has run; funding staleness is observable here but never gates /ready).
metrics_payload="$(curl -sf "${metrics_url}")"
if ! grep -q "okx_recorder_" <<<"${metrics_payload}"; then
  echo "local_e2e_check: ${metrics_url} did not expose okx_recorder_* metrics."
  exit 1
fi
for metric in okx_recorder_funding_poll_attempts_total okx_recorder_funding_last_event_unix_seconds; do
  if ! grep -q "${metric}" <<<"${metrics_payload}"; then
    echo "local_e2e_check: ${metrics_url} did not expose ${metric}."
    exit 1
  fi
done
echo "local_e2e_check: GET ${metrics_url} -> exposing okx_recorder_* metrics (incl. funding lane)"

echo "local_e2e_check: OK"

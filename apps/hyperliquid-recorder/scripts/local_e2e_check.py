#!/usr/bin/env python3
from __future__ import annotations

import os
import sys

import clickhouse_connect


def main() -> int:
    client = clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_LOCAL_HOST", "127.0.0.1"),
        port=int(os.getenv("CLICKHOUSE_LOCAL_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_LOCAL_USER", "recorder"),
        password=os.getenv("CLICKHOUSE_LOCAL_PASSWORD", "recorder"),
    )
    db = os.getenv("CLICKHOUSE_DATABASE", "pyth_analytics")
    table = os.getenv("CLICKHOUSE_TABLE", "hyperliquid_l2_snapshots")
    result = client.query(f"SELECT count() FROM {db}.{table}")
    first_item = result.first_item
    if isinstance(first_item, dict):
        count = int(next(iter(first_item.values())))
    elif first_item is None:
        count = 0
    else:
        count = int(first_item)
    print(f"local_e2e_check: table={db}.{table} rows={count}")
    if count <= 0:
        print(
            "local_e2e_check: no rows found yet; ensure stream auth/market config is correct."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

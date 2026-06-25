#!/bin/bash
# Docker entrypoint for bulk-trade-pusher.
# Converts the SIGNING_KEY_BASE58 env var into a temp key file so the binary
# can run without any mounted files (DigitalOcean / cloud deployment).
#
# Required env vars (set these in DigitalOcean App Platform):
#
#   SIGNING_KEY_BASE58                          Ed25519 private key (base58)
#   BULK_PUSHER__LAZER__ACCESS_TOKEN            Pyth Lazer access token
#   BULK_PUSHER__LAZER__ENDPOINTS               JSON array, e.g. '["wss://pyth-lazer-0.dourolabs.app/v1/stream"]'
#   BULK_PUSHER__BULK__ENDPOINTS                JSON array, e.g. '["wss://exchange-wss.bulk.trade/ws"]'
#   BULK_PUSHER__BULK__ORACLE_ACCOUNT_PUBKEY_BASE58   Oracle account public key (base58)
#   BULK_PUSHER__FEEDS__SUBSCRIPTIONS           JSON array, e.g. '[{"feed_id":86,"channel":"fixed_rate_1000ms"}]'
#
# Optional env vars (have defaults):
#   BULK_PUSHER__FEEDS__UPDATE_INTERVAL         default: 100ms
#   BULK_PUSHER__PROMETHEUS_ADDRESS             default: 0.0.0.0:9090
#   BULK_PUSHER__LAZER__NUM_CONNECTIONS         default: 2
#   BULK_PUSHER__LAZER__TIMEOUT                 default: 5s

set -e

if [ -n "${SIGNING_KEY_BASE58}" ]; then
    echo "${SIGNING_KEY_BASE58}" > /tmp/signing.key
    chmod 600 /tmp/signing.key
    export BULK_PUSHER__BULK__SIGNING_KEY_PATH=/tmp/signing.key
fi

exec /usr/local/bin/bulk-pusher --config /etc/bulk-pusher/config.toml "$@"

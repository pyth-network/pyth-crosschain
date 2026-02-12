# Pusher config template for Tilt local development
# {{VALIDATOR_ENDPOINTS}} is replaced by Tiltfile

prometheus_address = "0.0.0.0:9090"
health_address = "0.0.0.0:8080"

[lazer]
endpoints = [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
]
access_token = ""  # via BULK_PUSHER__LAZER__ACCESS_TOKEN
num_connections = 1
timeout = "5s"

[bulk]
endpoints = [
    {{VALIDATOR_ENDPOINTS}}
]
signing_key_path = "/secrets/signing.key"
oracle_account_pubkey_base58 = "LocalTestOracleAccount"

[feeds]
update_interval = "500ms"

[[feeds.subscriptions]]
feed_id = 1
channel = "fixed_rate_50ms"

[[feeds.subscriptions]]
feed_id = 2
channel = "fixed_rate_50ms"

[[feeds.subscriptions]]
feed_id = 3
channel = "fixed_rate_50ms"

#!/usr/bin/env bash

INIT_ARGS=$(cat <<-EOF
{
    "wormhole": "wormhole.wormhole.testnet",
    "codehash": [164, 14, 107, 15, 190, 232, 208, 235, 112, 211, 222, 28, 219, 44, 65, 197, 14, 136, 98, 3, 140, 61, 207, 211, 221, 184, 237, 78, 167, 115, 95, 234],
    "initial_source": {
        "emitter": [225, 1, 250, 237, 172, 88, 81, 227, 43, 155, 35, 181, 249, 65, 26, 140, 43, 172, 74, 174, 62, 212, 221, 123, 129, 29, 209, 167, 46, 164, 170, 113],
        "chain": 26
    },
    "gov_source": {
        "emitter": [86, 53, 151, 154, 34, 28, 52, 147, 30, 50, 98, 11, 146, 147, 164, 99, 6, 85, 85, 234, 113, 254, 151, 205, 98, 55, 173, 232, 117, 177, 46, 158],
        "chain": 1
    },
    "update_fee": "1",
    "stale_threshold": 60
}
EOF
)

INIT_JSON=$(echo "$INIT_ARGS" | jq -c '.' -M)

near deploy \
    --accountId "780e82bd52465f8a4f5ed8cf5a30666eb41208849956bf87a377da9d8174e2b7" \
    --wasmFile pyth.wasm \
    --initFunction new \
    --initArgs "$INIT_JSON"

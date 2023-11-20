#!/usr/bin/env bash

# This is an example payload for deploying the NEAR receiver contract. Note that the codehash can be obtained
# by `sha256sum` on the compiled contract. The initial and governance sources are the PythNet emitters for
# governance payloads.
INIT_ARGS=$(
	cat <<-EOF
		{
		    "wormhole": "wormhole.wormhole.testnet",
		    "codehash": [113, 49, 20, 252, 226, 220, 48, 15, 139, 92, 255, 117, 94, 178, 130, 162, 252, 5, 252, 188, 87, 122, 50, 175, 109, 12, 26, 189, 9, 107, 214, 116],
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

# Feed through jq to get compressed JSON to avoid CLI weirdness.
INIT_JSON=$(echo "$INIT_ARGS" | jq -c '.' -M)

# Deploy..
near deploy \
	--accountId "pyth.testnet" \
	--wasmFile pyth.wasm \
	--initFunction new \
	--initArgs "$INIT_JSON"

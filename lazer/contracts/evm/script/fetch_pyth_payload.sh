#!/bin/bash
# Fetch full JSON response from Pyth Lazer API for two different feed types
# Returns combined JSON with feed3 and feed112 responses
# Usage: ./fetch_pyth_payload.sh

API_URL="https://pyth-lazer-0.dourolabs.app/v1/latest_price"
BEARER_TOKEN="MeU4sOWhImaeacZHDOzr8l6RnDlnKXWjJeH-pdmo"

# Call 1: Feed 3 (Regular price feed - WITHOUT funding properties)
response_feed3=$(curl -X GET "$API_URL" \
  --header "Authorization: Bearer $BEARER_TOKEN" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "priceFeedIds": [3],
    "properties": ["price", "bestBidPrice", "bestAskPrice", "publisherCount", "exponent", "confidence"],
    "chains": ["evm"],
    "channel": "fixed_rate@200ms",
    "deliveryFormat": "json",
    "jsonBinaryEncoding": "hex"
  }' \
  --silent \
  --show-error)

# Call 2: Feed 112 (Funding rate feed - WITHOUT bestBidPrice, bestAskPrice, confidence)
response_feed112=$(curl -X GET "$API_URL" \
  --header "Authorization: Bearer $BEARER_TOKEN" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "priceFeedIds": [112],
    "properties": ["price", "publisherCount", "exponent", "fundingRate", "fundingTimestamp", "fundingRateInterval"],
    "chains": ["evm"],
    "channel": "fixed_rate@200ms",
    "deliveryFormat": "json",
    "jsonBinaryEncoding": "hex"
  }' \
  --silent \
  --show-error)

# Combine into single JSON object using jq if available
if command -v jq &> /dev/null; then
    jq -n --argjson feed3 "$response_feed3" --argjson feed112 "$response_feed112" \
        '{feed3: $feed3, feed112: $feed112}'
else
    # Fallback: manual JSON construction
    echo "{\"feed3\":$response_feed3,\"feed112\":$response_feed112}"
fi

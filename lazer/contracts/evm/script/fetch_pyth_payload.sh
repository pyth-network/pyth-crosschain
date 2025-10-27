#!/bin/bash
# Fetch full JSON response from Pyth Lazer API
# Returns complete JSON with both parsed data and binary encoding
# Usage: ./fetch_pyth_payload.sh

API_URL="https://pyth-lazer-0.dourolabs.app/v1/latest_price"
BEARER_TOKEN="MeU4sOWhImaeacZHDOzr8l6RnDlnKXWjJeH-pdmo"

# Call API and return full JSON response
curl -X GET "$API_URL" \
  --header "Authorization: Bearer $BEARER_TOKEN" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "priceFeedIds": [3, 112],
    "properties": ["price", "bestBidPrice", "bestAskPrice", "publisherCount", "exponent", "confidence", "fundingRate", "fundingTimestamp", "fundingRateInterval"],
    "chains": ["evm"],
    "channel": "fixed_rate@200ms",
    "deliveryFormat": "json",
    "jsonBinaryEncoding": "hex"
  }' \
  --silent \
  --show-error

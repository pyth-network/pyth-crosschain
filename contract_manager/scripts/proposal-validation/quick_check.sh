#!/usr/bin/env bash
# Dependency-light spot check of a handful of chains using foundry's `cast`.
# The Python scripts cover all 33 chains; this exists so a reviewer can confirm
# a few by hand without trusting any of it.
#
#   ./quick_check.sh
set -euo pipefail

# Expected Pyth Pro router set - contract_manager/src/core/base.ts,
# deploymentType "pro-compatible-production".
EXPECTED=(
  0x41534bb176e461a3fb30479400f210549ecce638
  0x6502987b62f21cab7eb5ccd8f0173084b60d5b41
  0x44a3e8f6a382412cf6bb90a3f8106e68977476c9
  0xd9d7d4529577864352c9a6539a48238fcd447052
  0x1663a5a822336ece48559b1dfb1e93a017a7dac3
)

# chain|rpc|wormhole  - wormhole = SetWormholeAddress target in proposal #314.
CHAINS=(
  "ethereum|https://ethereum-rpc.publicnode.com|0x3a2dd09b4739d905183d503d594c8fb3e3d41820"
  "arbitrum|https://arbitrum-one-rpc.publicnode.com|0x8d289cdd60e7f73f352f42c8524a06ef1ad746f8"
  "base|https://base-rpc.publicnode.com|0x581aaf059cc83a353fc51adc9a0480fbedfc6c55"
  "optimism|https://mainnet.optimism.io|0x237b7aff1af5d9f311f830234792d429355a58f3"
  "polygon|https://polygon-bor-rpc.publicnode.com|0xf0a1b566b55e0a0cb5bef52eb2a57142617bee67"
  "bsc|https://bsc-rpc.publicnode.com|0x6e7d74fa7d5c90fef9f0512987605a6d546181bb"
  "linea|https://linea-rpc.publicnode.com|0x621330d0ecd449a06b72f41c1a93626ccec53cca"
)

want=$(printf '%s,' "${EXPECTED[@]}" | sed 's/,$//')
echo "expected guardian set:"
printf '  %s\n' "${EXPECTED[@]}"
echo

fail=0
for row in "${CHAINS[@]}"; do
  IFS='|' read -r chain rpc wh <<< "$row"
  idx=$(cast call "$wh" "getCurrentGuardianSetIndex()(uint32)" --rpc-url "$rpc")
  got=$(cast call "$wh" "getGuardianSet(uint32)((address[],uint32))" "$idx" --rpc-url "$rpc" \
        | grep -oE '0x[0-9a-fA-F]{40}' | tr 'A-F' 'a-f' | paste -sd, -)
  if [ "$got" = "$want" ]; then
    printf '%-12s idx=%-3s MATCH\n' "$chain" "$idx"
  else
    printf '%-12s idx=%-3s MISMATCH\n' "$chain" "$idx"
    echo "   got : $got"
    echo "   want: $want"
    fail=1
  fi
done

exit "$fail"

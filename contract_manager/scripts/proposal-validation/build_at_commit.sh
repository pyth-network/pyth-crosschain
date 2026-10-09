#!/usr/bin/env bash
# Build PythUpgradable at one or more revisions and print a normalised digest
# for each, so deployed bytecode can be mapped back to a git revision.
#
#   ./build_at_commit.sh pyth-evm-contract-v1.4.6 4739bbcb8 ...
#
# The digest is comparable with check_evm_bytecode.py: immutables zeroed,
# unlinked library placeholders zeroed, trailing CBOR metadata stripped.
#
# Needs foundry. Uses a scratch git worktree so your checkout is untouched.
# Dependencies are assembled by hand rather than via `pnpm install`, because
# npm cannot parse the workspace's `catalog:` protocol - so the OpenZeppelin
# packages must already be present in the package's node_modules (see README).
set -uo pipefail

REPO=$(git rev-parse --show-toplevel)
PREP="$REPO/target_chains/ethereum/contracts"
WT=${WORKTREE:-/tmp/pyth-proposal-validation-wt}
C="$WT/target_chains/ethereum/contracts"

if [ ! -d "$PREP/node_modules/@openzeppelin" ]; then
  echo "error: $PREP/node_modules/@openzeppelin is missing - see README (Reproducing an EVM build)" >&2
  exit 2
fi

[ -d "$WT" ] || git -C "$REPO" worktree add -q --detach "$WT" HEAD

for REV in "$@"; do
  if ! git -C "$WT" checkout -q --detach "$REV" 2>/dev/null; then
    echo "$REV CHECKOUT_FAILED"; continue
  fi
  git -C "$WT" clean -qfd -e node_modules -e lib -e out -e cache 2>/dev/null

  # dependencies, in both the package dir and the repo root (older revisions
  # resolve @openzeppelin from ../../../node_modules)
  for base in "$C" "$WT"; do
    mkdir -p "$base/node_modules/@pythnetwork"
    for d in @openzeppelin @nomad-xyz; do
      [ -e "$base/node_modules/$d" ] || cp -r "$PREP/node_modules/$d" "$base/node_modules/" 2>/dev/null
    done
  done
  # copy rather than symlink: older revisions resolve these through
  # ../../../node_modules and foundry rejects symlinks that escape the project
  # root with "File outside of allowed directories".
  for pkg in pyth-sdk-solidity:sdk entropy-sdk-solidity:entropy_sdk pulse-sdk-solidity:pulse_sdk; do
    name=${pkg%%:*}; dir=${pkg##*:}
    src="$WT/target_chains/ethereum/$dir/solidity"
    [ -d "$src" ] || continue
    for base in "$C" "$WT"; do
      rm -rf "$base/node_modules/@pythnetwork/$name"
      cp -r "$src" "$base/node_modules/@pythnetwork/$name"
    done
  done
  mkdir -p "$C/lib"
  [ -e "$C/lib/forge-std" ] || cp -r "$PREP/lib/forge-std" "$C/lib/" 2>/dev/null

  [ -f "$C/foundry.toml" ] || { echo "$REV NO_FOUNDRY_TOML"; continue; }

  # the tests directory was called forge-test before the truffle->foundry move
  ( cd "$C" && rm -rf out cache && forge build --skip test --skip script --skip forge-test >/dev/null 2>&1 ) \
    || { echo "$REV BUILD_FAILED"; continue; }

  ART="$C/out/PythUpgradable.sol/PythUpgradable.json"
  [ -f "$ART" ] || { echo "$REV NO_ARTIFACT"; continue; }

  REV="$REV" python3 - "$ART" <<'PY'
import json, os, re, sys, hashlib
a = json.load(open(sys.argv[1]))
db = a["deployedBytecode"]
obj = db["object"][2:]
obj = re.sub(r"__\$[0-9a-fA-F]{34}\$__", "0"*40, obj)
obj = re.sub(r"__[A-Za-z0-9_]{36}__", "0"*40, obj)
code = bytearray(bytes.fromhex(obj))
for _, refs in (db.get("immutableReferences") or {}).items():
    for r in refs:
        code[r["start"]:r["start"]+r["length"]] = b"\x00"*r["length"]
n = int.from_bytes(code[-2:], "big")
end = len(code)-(n+2) if 0 < n < 200 and len(code) > n+2 else len(code)
print(f"{os.environ['REV']} OK len={len(code)} digest={hashlib.sha3_256(bytes(code[:end])).hexdigest()}")
PY
done

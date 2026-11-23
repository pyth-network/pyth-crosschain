#!/usr/bin/env python3
"""Read the guardian sets held by an SVM (Solana-style) Wormhole core bridge.

The SVM counterpart of check_guardian_sets.py. On EVM the guardian set is
returned by a view function; on SVM it lives in `GuardianSet` PDAs
(`seeds = ["GuardianSet", index_be_u32]`) owned by the bridge, and the set
currently in force is named by `config.guardian_set_index` in the `Bridge` PDA.

The expected router set is parsed out of the core-bridge source constant
`_PYTH_INITIAL_MULTISIG_SET_PROD`, which `initialize()` installs at index 0 —
so the check tracks the source of truth rather than a hardcoded list.

Usage:
    python3 check_svm_guardians.py                       # all known bridges
    python3 check_svm_guardians.py --program <id> --rpc <url>
"""

import argparse
import base64
import json
import re
import struct
import sys
import urllib.request

import common
from decode_proposal import find_program_address

INITIALIZE_RS = (
    "target_chains/solana/programs/core-bridge/src/legacy/processor/initialize.rs"
)

# (label, program id, rpc). Both bridges are the same codebase built with and
# without the `pro-compatible` cargo feature (see core-bridge/src/lib.rs).
DEFAULT_BRIDGES = [
    ("solana / migrating bridge", "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ",
     "https://api.mainnet-beta.solana.com"),
    ("solana / pro-compatible", "HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL",
     "https://api.mainnet-beta.solana.com"),
    ("fogo / migrating bridge", "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ",
     "https://mainnet.fogo.io"),
    ("fogo / pro-compatible", "HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL",
     "https://mainnet.fogo.io"),
]


def expected_router_set(name="_PYTH_INITIAL_MULTISIG_SET_PROD"):
    path = f"{common.REPO_ROOT}/{INITIALIZE_RS}"
    src = open(path).read()
    i = src.index(name)
    j = src.index("= [", i) + 3
    depth, k = 1, j
    while depth:
        if src[k] == "[":
            depth += 1
        elif src[k] == "]":
            depth -= 1
        k += 1
    nums = re.findall(r"0x([0-9a-fA-F]{2})", src[j:k])
    return ["".join(nums[t:t + 20]) for t in range(0, len(nums), 20)]


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, body, common.UA)
    res = json.load(urllib.request.urlopen(req, timeout=60))
    if "error" in res:
        raise RuntimeError(f"{method}: {res['error']}")
    return res["result"]


def get_account(url, address):
    v = rpc(url, "getAccountInfo", [address, {"encoding": "base64"}])["value"]
    return base64.b64decode(v["data"][0]) if v else None


def parse_guardian_set(raw):
    """Handle both the anchor-discriminated and the legacy layout."""
    for skip in (8, 0):
        try:
            i = skip
            index = struct.unpack_from("<I", raw, i)[0]; i += 4
            n = struct.unpack_from("<I", raw, i)[0]; i += 4
            if not (0 < n <= 64) or i + n * 20 + 8 > len(raw):
                continue
            keys = [raw[i + j * 20: i + (j + 1) * 20].hex() for j in range(n)]
            i += n * 20
            creation, expiration = struct.unpack_from("<II", raw, i)
            return {"index": index, "keys": keys, "creation_time": creation,
                    "expiration_time": expiration, "layout": "anchor" if skip else "legacy"}
        except struct.error:
            continue
    return None


def parse_config(raw):
    """Config { u32 guardian_set_index, [u8;8] gap, u32 ttl, u64 fee }."""
    for skip in (8, 0):
        try:
            idx = struct.unpack_from("<I", raw, skip)[0]
            ttl = struct.unpack_from("<I", raw, skip + 12)[0]
            fee = struct.unpack_from("<Q", raw, skip + 16)[0]
            if idx < 1000:
                return {"guardian_set_index": idx, "guardian_set_ttl": ttl,
                        "fee_lamports": fee, "layout": "anchor" if skip else "legacy"}
        except struct.error:
            continue
    return None


def inspect(label, program, url, expected, max_index):
    print(f"\n=== {label}")
    print(f"    program {program}")
    print(f"    rpc     {url}")
    out = {"label": label, "program": program, "rpc": url, "guardian_sets": {}}
    try:
        code = get_account(url, program)
    except Exception as exc:  # noqa: BLE001
        print(f"    ERROR: {exc}")
        out["error"] = str(exc)
        return out
    if code is None:
        print("    program account NOT FOUND on this chain")
        out["error"] = "program not found"
        return out

    cfg_pda, _ = find_program_address([b"Bridge"], program)
    try:
        cfg_raw = get_account(url, cfg_pda)
    except Exception as exc:  # noqa: BLE001
        cfg_raw = None
        print(f"    config read error: {exc}")
    if cfg_raw:
        cfg = parse_config(cfg_raw)
        out["config"] = cfg
        print(f"    config ({cfg_pda}): guardian_set_index={cfg['guardian_set_index']} "
              f"ttl={cfg['guardian_set_ttl']} fee_lamports={cfg['fee_lamports']}")
    else:
        print(f"    config PDA {cfg_pda}: NOT INITIALIZED")
        out["config"] = None

    found = 0
    for idx in range(max_index + 1):
        pda, _ = find_program_address([b"GuardianSet", struct.pack(">I", idx)], program)
        try:
            raw = get_account(url, pda)
        except Exception:  # noqa: BLE001
            continue
        if raw is None:
            continue
        found += 1
        gs = parse_guardian_set(raw)
        if gs is None:
            print(f"    index {idx}: {pda} (unparsed, {len(raw)} bytes)")
            continue
        match = gs["keys"] == expected
        out["guardian_sets"][idx] = {**gs, "pda": pda, "matches_router_set": match}
        tag = "  <-- MATCHES Pyth Pro router set" if match else ""
        print(f"    index {idx}: {len(gs['keys'])} guardians, "
              f"expiration={gs['expiration_time']}{tag}")
        if match or len(gs["keys"]) <= 5:
            for g in gs["keys"]:
                print(f"        0x{g}")
    if found == 0:
        print("    no GuardianSet accounts found")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--program")
    ap.add_argument("--rpc")
    ap.add_argument("--max-index", type=int, default=8)
    ap.add_argument("--out")
    args = ap.parse_args()

    expected = expected_router_set()
    print("expected Pyth Pro router set (core-bridge _PYTH_INITIAL_MULTISIG_SET_PROD,")
    print("installed by initialize() at guardian set index 0):")
    for i, g in enumerate(expected):
        print(f"  {i}  0x{g}")

    bridges = ([(f"{args.program}", args.program, args.rpc)]
               if args.program and args.rpc else DEFAULT_BRIDGES)
    results = [inspect(l, p, u, expected, args.max_index) for l, p, u in bridges]

    if args.out:
        json.dump(results, open(args.out, "w"), indent=2)
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

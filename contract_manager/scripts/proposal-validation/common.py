"""Shared helpers for validating Pyth governance proposals.

Deliberately dependency-free (Python 3 stdlib only) so the scripts can be run
against a fresh checkout without a pnpm install.
"""

import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

CHAINS_TS = os.path.join(
    REPO_ROOT,
    "governance/xc_admin/packages/xc_admin_common/src/chains.ts",
)
BASE_TS = os.path.join(REPO_ROOT, "contract_manager/src/core/base.ts")
STORE = os.path.join(REPO_ROOT, "contract_manager/src/store")

UA = {
    "content-type": "application/json",
    # Several public RPCs 403 a bare urllib user-agent.
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
}

# Wormhole-assigned ids that Pyth reuses rather than redefining in RECEIVER_CHAINS.
# chains.ts does `{...WORMHOLE_CHAINS, ...RECEIVER_CHAINS}`, so these are only
# consulted for ids RECEIVER_CHAINS does not define.
WORMHOLE_CHAINS = {
    1: "solana", 3: "terra", 8: "algorand", 11: "moonbeam", 12: "neon",
    13: "klaytn", 15: "near", 16: "moonbeam", 18: "terra2", 20: "osmosis",
    21: "sui", 22: "aptos", 26: "pythnet", 28: "xpla", 29: "btc", 30: "base",
    32: "sei", 34: "scroll", 35: "mantle", 36: "blast", 37: "xlayer",
    39: "linea", 40: "berachain", 44: "unichain",
}


def load_chain_ids():
    """chain id -> chain name, mirroring chains.ts CHAINS."""
    src = open(CHAINS_TS).read()
    block = src.split("RECEIVER_CHAINS = {")[1].split("\n};")[0]
    out = dict(WORMHOLE_CHAINS)
    for name, cid in re.findall(r"^\s*([a-z0-9_]+):\s*(\d+),", block, re.M):
        out[int(cid)] = name
    return out


def load_expected_guardian_set(deployment="pro-compatible-production"):
    """Pull the canonical guardian set + quorum out of contract_manager/src/core/base.ts.

    Read from the repo rather than hardcoded so the check tracks the source of truth.
    """
    src = open(BASE_TS).read()
    marker = f'deploymentType === "{deployment}"'
    idx = src.find(marker)
    if idx < 0:
        raise SystemExit(f"deployment type {deployment!r} not found in {BASE_TS}")
    tail = src[idx:]
    gs = tail.split("initialGuardianSet: [")[1].split("]")[0]
    guardians = [g.lower() for g in re.findall(r'"([0-9a-fA-F]{40})"', gs)]
    quorum = re.search(r'quorum:\s*"(\w+)"', tail).group(1)
    ds = tail.split("dataSources: [")[1].split("],")[0]
    emitter = re.search(r'emitterAddress:\s*\n?\s*"([0-9a-f]{64})"', ds).group(1)
    chain = int(re.search(r"emitterChain:\s*(\d+)", ds).group(1))
    return {
        "guardians": guardians,
        "quorum": quorum,
        "data_source": {"emitter_chain": chain, "emitter_address": emitter},
    }


def quorum_threshold(n, rule):
    """Signature count required for n guardians.

    Mirrors the two Solidity implementations:
      ReceiverMessages.quorumThreshold           -> (((n*10)/3)*2)/10 + 1   (2/3)
      ReceiverImplementationHalf.quorumThreshold -> n/2 + 1                 (majority)
    """
    if rule == "half":
        return n // 2 + 1
    return (((n * 10) // 3) * 2) // 10 + 1


def load_store(name):
    return json.load(open(os.path.join(STORE, name)))


def evm_chains():
    return {c["id"]: c for c in load_store("chains/EvmChains.json")}


def price_feed_contracts():
    out = {}
    for c in load_store("contracts/EvmPriceFeedContracts.json"):
        out.setdefault(c["chain"], c["address"])
    return out


def rpc_fallbacks():
    path = os.path.join(os.path.dirname(__file__), "rpc_fallbacks.json")
    return json.load(open(path)) if os.path.exists(path) else {}


def eth_call(url, to, data, tries=3, timeout=40):
    """Returns (result_hex, error_string)."""
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"],
        }
    ).encode()
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, body, UA)
            res = json.load(urllib.request.urlopen(req, timeout=timeout))
            if "error" in res:
                last = res["error"].get("message", "rpc error")
                continue
            return res["result"], None
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller as text
            last = f"{type(exc).__name__}: {exc}"
            # Public endpoints rate-limit aggressively; back off before retrying.
            if "429" in last or "503" in last:
                time.sleep(1.5 * (attempt + 1))
    return None, last


def eth_call_any(urls, to, data):
    """Try each endpoint in turn. Returns (result, url_used, error)."""
    err = None
    for url in urls:
        res, err = eth_call(url, to, data)
        if err is None:
            return res, url, None
    return None, None, err


def eth_get_code(url, address, tries=3, timeout=40):
    """Returns (code_hex, error_string)."""
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_getCode",
         "params": [address, "latest"]}
    ).encode()
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, body, UA)
            res = json.load(urllib.request.urlopen(req, timeout=timeout))
            if "error" in res:
                last = res["error"].get("message", "rpc error")
                continue
            return res["result"], None
        except Exception as exc:  # noqa: BLE001
            last = f"{type(exc).__name__}: {exc}"
            if "429" in last or "503" in last:
                time.sleep(1.5 * (attempt + 1))
    return None, last


def eth_get_code_any(urls, address):
    err = None
    for url in urls:
        res, err = eth_get_code(url, address)
        if err is None:
            return res, url, None
    return None, None, err


def eth_get_storage(url, address, slot, tries=3, timeout=40):
    """Returns (value_hex, error_string)."""
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_getStorageAt",
         "params": [address, slot, "latest"]}
    ).encode()
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, body, UA)
            res = json.load(urllib.request.urlopen(req, timeout=timeout))
            if "error" in res:
                last = res["error"].get("message", "rpc error")
                continue
            return res["result"], None
        except Exception as exc:  # noqa: BLE001
            last = f"{type(exc).__name__}: {exc}"
            if "429" in last or "503" in last:
                time.sleep(1.5 * (attempt + 1))
    return None, last


def eth_get_storage_any(urls, address, slot):
    err = None
    for url in urls:
        res, err = eth_get_storage(url, address, slot)
        if err is None:
            return res, url, None
    return None, None, err


def http_get(url, headers=None, timeout=40):
    hdrs = dict(UA)
    hdrs.pop("content-type", None)
    hdrs.update(headers or {})
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def parallel(fn, items, workers=12):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(fn, items))


# ---------------------------------------------------------------- ABI decoding

def dec_uint(hexstr):
    return int(hexstr, 16)


def dec_address(hexstr):
    return "0x" + hexstr[-40:].lower()


def dec_guardian_set(hexstr):
    """Decode GuardianSet{address[] keys; uint32 expirationTime}."""
    b = bytes.fromhex(hexstr[2:])
    struct_off = int.from_bytes(b[0:32], "big")
    keys_off = int.from_bytes(b[struct_off : struct_off + 32], "big")
    expiry = int.from_bytes(b[struct_off + 32 : struct_off + 64], "big")
    arr = struct_off + keys_off
    n = int.from_bytes(b[arr : arr + 32], "big")
    keys = [
        "0x" + b[arr + 32 + i * 32 + 12 : arr + 32 + (i + 1) * 32].hex()
        for i in range(n)
    ]
    return keys, expiry


def enc_bytes_arg(selector, payload_hex):
    """ABI-encode a single `bytes` argument."""
    b = bytes.fromhex(payload_hex)
    pad = (-len(b)) % 32
    return selector + f"{32:064x}" + f"{len(b):064x}" + b.hex() + "00" * pad

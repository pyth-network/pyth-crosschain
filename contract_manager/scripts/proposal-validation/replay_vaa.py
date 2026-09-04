#!/usr/bin/env python3
"""End-to-end check: does a real Pyth Pro VAA verify on the proposed contracts?

This is the strongest form of the guardian-set check. Rather than only comparing
addresses, it fetches a live signed price update from the Pyth Pro
Core-compatible (Hermes) API and calls parseAndVerifyVM() on every Wormhole
contract the proposal switches to. It also recovers the signers locally so the
routers that actually sign can be compared against the on-chain set.

It doubles as a quorum check: Pyth Pro signs 3-of-5, so a contract built with
the 2/3 quorum rule (which needs 4-of-5) would reject these VAAs outright.

Needs PYTH_API_KEY. Usage:
    python3 replay_vaa.py /tmp/report314.json [--out replay.json]
"""

import argparse
import json
import os
import struct
import sys

import common
import crypto

SEL_PARSE_AND_VERIFY = "0xc0fd8bde"  # parseAndVerifyVM(bytes)
HERMES = "https://pyth.dourolabs.app/hermes"
# BTC/USD - any active feed works; the VAA signatures are what matter.
DEFAULT_FEED = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"


def fetch_update(feed_id, api_key):
    url = f"{HERMES}/v2/updates/price/latest?ids[]={feed_id}&encoding=hex"
    raw = common.http_get(url, headers={"Authorization": f"Bearer {api_key}"})
    return json.loads(raw)["binary"]["data"][0]


def strip_pnau(hexstr):
    """Unwrap a Pyth accumulator (PNAU) envelope down to the raw Wormhole VAA."""
    b = bytes.fromhex(hexstr)
    if b[:4] != b"PNAU":
        return b
    off = 4
    off += 2                    # major, minor version
    trailing = b[off]; off += 1
    off += trailing             # trailing header
    off += 1                    # update type
    vaa_len = int.from_bytes(b[off : off + 2], "big"); off += 2
    return b[off : off + vaa_len]


def parse_vaa(b):
    off = 0
    version = b[off]; off += 1
    gs_index = int.from_bytes(b[off : off + 4], "big"); off += 4
    sig_count = b[off]; off += 1
    sigs = []
    for _ in range(sig_count):
        sigs.append({
            "guardian_index": b[off],
            "r": int.from_bytes(b[off + 1 : off + 33], "big"),
            "s": int.from_bytes(b[off + 33 : off + 65], "big"),
            "v": b[off + 65],
        })
        off += 66
    body = b[off:]
    digest = crypto.keccak256(crypto.keccak256(body))
    return {
        "version": version,
        "guardian_set_index": gs_index,
        "signature_count": sig_count,
        "signatures": sigs,
        "digest": digest,
        "emitter_chain": int.from_bytes(body[8:10], "big"),
        "emitter_address": body[10:42].hex(),
        "sequence": int.from_bytes(body[42:50], "big"),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report", help="JSON produced by check_guardian_sets.py --out")
    ap.add_argument("--feed", default=DEFAULT_FEED)
    ap.add_argument("--samples", type=int, default=1, help="how many updates to fetch for signer recovery")
    ap.add_argument("--out")
    args = ap.parse_args()

    api_key = os.environ.get("PYTH_API_KEY")
    if not api_key:
        raise SystemExit("PYTH_API_KEY is not set")

    report = json.load(open(args.report))
    expected = report["expected"]["guardians"]
    need = report["quorum_required"]

    seen_signers, parsed = {}, None
    vaa_hex = None
    for i in range(max(1, args.samples)):
        vaa = strip_pnau(fetch_update(args.feed, api_key))
        parsed = parse_vaa(vaa)
        if i == 0:
            vaa_hex = vaa.hex()
        for sig in parsed["signatures"]:
            addr = crypto.ecrecover(parsed["digest"], sig["r"], sig["s"], sig["v"])
            seen_signers.setdefault(addr, set()).add(sig["guardian_index"])

    print(f"live Pyth Pro VAA")
    print(f"  guardian set index : {parsed['guardian_set_index']}")
    print(f"  signatures         : {parsed['signature_count']}  (quorum requires {need})")
    print(f"  emitter chain      : {parsed['emitter_chain']}")
    print(f"  emitter address    : 0x{parsed['emitter_address']}")
    try:
        print(f"  emitter (ascii)    : {bytes.fromhex(parsed['emitter_address']).decode('ascii')}")
    except UnicodeDecodeError:
        pass

    print(f"\nrecovered signers ({len(seen_signers)} distinct over {args.samples} sample(s)):")
    bad_signer = []
    for addr, idxs in sorted(seen_signers.items(), key=lambda kv: min(kv[1])):
        at = sorted(idxs)
        ok = all(0 <= i < len(expected) and expected[i] == addr[2:] for i in at)
        if not ok:
            bad_signer.append((addr, at))
        print(f"  index {','.join(map(str, at)):6} {addr}  {'OK' if ok else 'NOT IN EXPECTED SET'}")
    unseen = [i for i in range(len(expected)) if i not in {x for s in seen_signers.values() for x in s}]
    if unseen:
        print(f"  (indices never observed signing in this sample: {unseen} - "
              f"expected with {need}-of-{len(expected)} quorum)")

    if parsed["signature_count"] < need:
        print(f"\nWARNING: VAA carries {parsed['signature_count']} signatures but quorum needs {need}")

    call = common.enc_bytes_arg(SEL_PARSE_AND_VERIFY, vaa_hex)
    chains = {n: r for n, r in report["results"].items() if r.get("guardians")}
    print(f"\nreplaying VAA against {len(chains)} Wormhole contracts ...")

    def run(item):
        name, r = item
        urls = [r["rpc_used"]] if r.get("rpc_used") else []
        res, _u, err = common.eth_call_any(urls, r["new_wormhole"], call)
        if err or not res or res == "0x":
            return name, {"error": err or "empty return (reverted)"}
        b = bytes.fromhex(res[2:])
        valid = int.from_bytes(b[32:64], "big") == 1
        roff = int.from_bytes(b[64:96], "big")
        rlen = int.from_bytes(b[roff : roff + 32], "big")
        reason = b[roff + 32 : roff + 32 + rlen].decode("utf8", "replace")
        return name, {"valid": valid, "reason": reason}

    results = dict(common.parallel(run, list(chains.items())))
    accepted = [n for n, v in results.items() if v.get("valid")]
    rejected = [(n, v) for n, v in results.items() if not v.get("valid")]

    print(f"  accepted (valid=true): {len(accepted)}/{len(chains)}")
    if rejected:
        print("  NOT accepted:")
        for n, v in sorted(rejected):
            print(f"    {n:26} {v.get('reason') or v.get('error')}")

    if args.out:
        json.dump({"vaa": parsed | {"digest": parsed["digest"].hex(), "signatures": None},
                   "signers": {k: sorted(v) for k, v in seen_signers.items()},
                   "replay": results}, open(args.out, "w"), indent=2, default=str)
        print(f"\nwrote {args.out}")

    problems = bool(rejected or bad_signer)
    print("\nRESULT:", "FAIL" if problems else "PASS")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

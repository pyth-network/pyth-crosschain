#!/usr/bin/env python3
"""Compare the implementations a proposal upgrades to against a build from source.

For every `UpgradeContract` action this:
  1A  fetches the deployed code at the proposed implementation, normalises it,
      and (with --artifact) compares it to a local `forge build` artifact;
  1B  reads the ERC-1967 implementation slot on each proxy to find what is
      deployed *today*, and reports its version() and normalised digest.

Normalisation makes implementations comparable across chains:
  * every occurrence of the contract's own address is zeroed. UUPS stores
    `address immutable __self = address(this)`, so the same build lands at a
    different address on every chain and differs in exactly those bytes;
  * the trailing CBOR metadata block is stripped. It is never executed and its
    IPFS hash covers source paths and resolved settings, so it varies with the
    build environment even when every compiled byte is identical.

Usage:
    python3 decode_proposal.py <proposal> --out actions.json
    cd ../../../target_chains/ethereum/contracts && forge build --skip test --skip script
    python3 check_evm_bytecode.py actions.json \
        --artifact ../../../target_chains/ethereum/contracts/out/PythUpgradable.sol/PythUpgradable.json
"""

import argparse
import hashlib
import json
import re
import sys

import common

ERC1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
SEL_VERSION = "0x54fd4d50"  # version()


def strip_metadata(code):
    """Drop the trailing CBOR metadata block, if the length suffix looks sane."""
    n = int.from_bytes(code[-2:], "big")
    if 0 < n < 200 and len(code) > n + 2:
        return code[: len(code) - (n + 2)], code[len(code) - (n + 2):]
    return code, b""


def normalise(code_hex, own_address):
    code = bytes.fromhex(code_hex[2:])
    code = code.replace(bytes.fromhex(own_address[2:]), b"\x00" * 20)
    body, meta = strip_metadata(code)
    return {
        "len": len(code),
        "digest": hashlib.sha3_256(body).hexdigest(),
        "metadata": meta.hex(),
    }


def artifact_digest(path):
    """Normalised digest of a forge deployedBytecode artifact."""
    a = json.load(open(path))
    db = a["deployedBytecode"]
    obj = db["object"][2:]
    # unlinked library placeholders -> zeros, so old versions hash stably
    obj = re.sub(r"__\$[0-9a-fA-F]{34}\$__", "0" * 40, obj)
    obj = re.sub(r"__[A-Za-z0-9_]{36}__", "0" * 40, obj)
    code = bytearray(bytes.fromhex(obj))
    for _, refs in (db.get("immutableReferences") or {}).items():
        for r in refs:
            code[r["start"]: r["start"] + r["length"]] = b"\x00" * r["length"]
    body, meta = strip_metadata(bytes(code))
    return {"len": len(code), "digest": hashlib.sha3_256(body).hexdigest(),
            "metadata": meta.hex()}


def endpoints(chain, chains_meta, fallbacks):
    urls = []
    meta = chains_meta.get(chain)
    if meta and meta.get("rpcUrl"):
        urls.append(meta["rpcUrl"])
    return urls + [u for u in fallbacks.get(chain, []) if u not in urls]


def dec_string(hexstr):
    b = bytes.fromhex(hexstr[2:])
    off = int.from_bytes(b[:32], "big")
    n = int.from_bytes(b[off: off + 32], "big")
    return b[off + 32: off + 32 + n].decode("utf8", "replace")


def check(job):
    chain, new_impl, urls, proxy, skip_current = job
    out = {"chain": chain, "new_impl": new_impl, "errors": []}
    if not urls:
        out["errors"].append("no RPC endpoint known")
        return out

    code, url, err = common.eth_get_code_any(urls, new_impl)
    if err or not code or code == "0x":
        out["errors"].append(f"getCode(new impl): {err or 'no code at address'}")
        return out
    out["proposed"] = normalise(code, new_impl)

    if skip_current or not proxy:
        return out
    out["proxy"] = proxy
    slot, _u, err = common.eth_get_storage_any(urls, proxy, ERC1967_IMPL_SLOT)
    if err or not slot:
        out["errors"].append(f"eth_getStorageAt: {err}")
        return out
    cur = "0x" + slot[-40:]
    out["current_impl"] = cur
    out["changes"] = cur.lower() != new_impl.lower()
    ccode, _u, err = common.eth_get_code_any(urls, cur)
    if err or not ccode or ccode == "0x":
        out["errors"].append(f"getCode(current impl): {err}")
    else:
        out["current"] = normalise(ccode, cur)
    ver, _u, err = common.eth_call_any(urls, proxy, SEL_VERSION)
    if not err and ver and ver != "0x":
        try:
            out["version"] = dec_string(ver)
        except Exception:  # noqa: BLE001, S110
            pass
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("actions", help="JSON produced by decode_proposal.py --out")
    ap.add_argument("--artifact", help="forge artifact to compare against (PythUpgradable.json)")
    ap.add_argument("--out", help="write the full report here")
    ap.add_argument("--skip-current", action="store_true")
    args = ap.parse_args()

    actions = json.load(open(args.actions))["actions"]
    targets = [a for a in actions if a.get("action") == "UpgradeContract"]
    if not targets:
        raise SystemExit("no UpgradeContract actions in this proposal")

    chains_meta, fallbacks, feeds = common.evm_chains(), common.rpc_fallbacks(), common.price_feed_contracts()
    jobs = [(a["chain"], "0x" + a["body"], endpoints(a["chain"], chains_meta, fallbacks),
             feeds.get(a["chain"]), args.skip_current) for a in targets]

    print(f"querying {len(jobs)} chains ...")
    results = {r["chain"]: r for r in common.parallel(check, jobs)}

    ok = [r for r in results.values() if r.get("proposed")]
    failed = [r for r in results.values() if not r.get("proposed")]

    groups = {}
    for r in ok:
        groups.setdefault(r["proposed"]["digest"], []).append(r["chain"])
    metas = {r["proposed"]["metadata"] for r in ok}

    print(f"\n--- proposed implementations ---")
    print(f"readable                 : {len(ok)}/{len(results)}")
    print(f"distinct normalised code : {len(groups)}")
    for dg, chains in sorted(groups.items(), key=lambda x: -len(x[1])):
        print(f"  {dg}  x{len(chains)}")
    print(f"distinct metadata blocks : {len(metas)}"
          f"{'  (all from one build)' if len(metas) == 1 else ''}")

    problems = bool(failed)
    if args.artifact:
        built = artifact_digest(args.artifact)
        print(f"\n--- source build ---")
        print(f"artifact : {args.artifact}")
        print(f"len      : {built['len']}")
        print(f"digest   : {built['digest']}")
        matched = [dg for dg in groups if dg == built["digest"]]
        n = sum(len(groups[dg]) for dg in matched)
        print(f"\nMATCH: {n}/{len(ok)} chains reproduce from this build")
        if n != len(ok):
            problems = True
            for dg, chains in groups.items():
                if dg != built["digest"]:
                    print(f"  MISMATCH {dg} -> {sorted(chains)}")
        if metas and built["metadata"] not in metas:
            print("\nnote: metadata block differs from the deployed one. This region is "
                  "never executed; it varies with the build environment. Executable "
                  "bytes are compared above.")

    if not args.skip_current:
        vers = {}
        for r in ok:
            if r.get("current"):
                vers.setdefault((r.get("version"), r["current"]["digest"]), []).append(r["chain"])
        print(f"\n--- currently deployed ---")
        print(f"{'version':16} {'digest':20} n   chains")
        for (v, dg), chains in sorted(vers.items(), key=lambda x: -len(x[1])):
            print(f"{str(v):16} {dg[:18]}… {len(chains):<3} {', '.join(sorted(chains))}")
        changing = [r['chain'] for r in ok if r.get('changes')]
        print(f"\nimplementation changes on {len(changing)}/{len(ok)} chains")

    if failed:
        print("\nUNREADABLE:")
        for r in failed:
            print(f"  {r['chain']:26} {r['errors'][:1]}")

    if args.out:
        json.dump(results, open(args.out, "w"), indent=2)
        print(f"\nwrote {args.out}")

    print("\nRESULT:", "FAIL" if problems else "PASS")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

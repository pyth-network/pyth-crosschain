#!/usr/bin/env python3
"""Validate the Wormhole contracts a proposal switches to, and their guardian sets.

For every `SetWormholeAddress` action in a decoded proposal this:
  2A  resolves the target Wormhole contract and checks its self-reported chainId
      matches the chain the governance message is addressed to;
  2B  reads getCurrentGuardianSetIndex() / getGuardianSet(idx) off that contract;
  2C  compares the result against the canonical Pyth Pro router set in
      contract_manager/src/core/base.ts.

It also records the pre-upgrade state (the Wormhole contract the Pyth price feed
contract currently points at) so the change is fully characterised.

Usage:
    python3 decode_proposal.py <proposal> --out actions.json
    python3 check_guardian_sets.py actions.json [--out report.json] [--skip-before]
"""

import argparse
import json
import sys

import common

SEL_GUARDIAN_SET_INDEX = "0x1cfe7951"  # getCurrentGuardianSetIndex()
SEL_GUARDIAN_SET = "0xf951975a"        # getGuardianSet(uint32)
SEL_WORMHOLE = "0x84acd1bb"            # wormhole()
SEL_CHAIN_ID = "0x9a8a0592"            # chainId()
SEL_GOV_CHAIN_ID = "0xfbe3c2cd"        # governanceChainId()
SEL_GOV_CONTRACT = "0xb172b222"        # governanceContract()


def endpoints(chain, chains_meta, fallbacks):
    urls = []
    meta = chains_meta.get(chain)
    if meta and meta.get("rpcUrl"):
        urls.append(meta["rpcUrl"])
    urls += [u for u in fallbacks.get(chain, []) if u not in urls]
    return urls


def check_chain(job):
    chain, chain_id, wormhole, urls, pyth_contract, skip_before = job
    out = {"chain": chain, "chain_id": chain_id, "new_wormhole": wormhole, "errors": []}
    if not urls:
        out["errors"].append("no RPC endpoint known for this chain")
        return out

    idx_hex, url, err = common.eth_call_any(urls, wormhole, SEL_GUARDIAN_SET_INDEX)
    if err or idx_hex in (None, "0x"):
        out["errors"].append(f"getCurrentGuardianSetIndex: {err or 'empty return (no code?)'}")
        return out
    out["rpc_used"] = url
    idx = common.dec_uint(idx_hex)
    out["guardian_set_index"] = idx

    gs_hex, err = common.eth_call(url, wormhole, SEL_GUARDIAN_SET + f"{idx:064x}")
    if err or not gs_hex:
        out["errors"].append(f"getGuardianSet({idx}): {err}")
        return out
    try:
        keys, expiry = common.dec_guardian_set(gs_hex)
    except Exception as exc:  # noqa: BLE001
        out["errors"].append(f"decode getGuardianSet: {exc}")
        return out
    out["guardians"] = [k.lower() for k in keys]
    out["expiration"] = expiry

    for label, sel in (
        ("wormhole_chain_id", SEL_CHAIN_ID),
        ("governance_chain_id", SEL_GOV_CHAIN_ID),
        ("governance_contract", SEL_GOV_CONTRACT),
    ):
        res, err = common.eth_call(url, wormhole, sel)
        if err:
            out["errors"].append(f"{label}: {err}")
        elif res and res != "0x":
            out[label] = res if label == "governance_contract" else common.dec_uint(res)

    if not skip_before and pyth_contract:
        out["pyth_contract"] = pyth_contract
        res, _u, err = common.eth_call_any(urls, pyth_contract, SEL_WORMHOLE)
        if err or not res or res == "0x":
            out["errors"].append(f"pyth.wormhole(): {err or 'empty'}")
        else:
            cur = common.dec_address(res)
            out["current_wormhole"] = cur
            out["wormhole_changes"] = cur != wormhole.lower()
            ci, _u, err = common.eth_call_any(urls, cur, SEL_GUARDIAN_SET_INDEX)
            if not err and ci:
                cidx = common.dec_uint(ci)
                out["current_guardian_set_index"] = cidx
                cg, _u, err = common.eth_call_any(urls, cur, SEL_GUARDIAN_SET + f"{cidx:064x}")
                if not err and cg:
                    try:
                        ck, _ = common.dec_guardian_set(cg)
                        out["current_guardians"] = [k.lower() for k in ck]
                    except Exception:  # noqa: BLE001, S110
                        pass
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("actions", help="JSON produced by decode_proposal.py --out")
    ap.add_argument("--deployment", default="pro-compatible-production")
    ap.add_argument("--out", help="write the full report to this JSON file")
    ap.add_argument("--skip-before", action="store_true", help="skip pre-upgrade state lookup")
    args = ap.parse_args()

    expected = common.load_expected_guardian_set(args.deployment)
    exp_guardians = expected["guardians"]
    need = common.quorum_threshold(len(exp_guardians), expected["quorum"])
    print(f"expected guardian set ({args.deployment}, from contract_manager/src/core/base.ts):")
    for i, g in enumerate(exp_guardians):
        print(f"  {i}  0x{g}")
    print(f"quorum rule: {expected['quorum']} -> {need} of {len(exp_guardians)} signatures required")
    print(f"expected data source: chain {expected['data_source']['emitter_chain']} "
          f"emitter 0x{expected['data_source']['emitter_address']}\n")

    decoded = json.load(open(args.actions))
    actions = decoded["actions"]
    chains_meta = common.evm_chains()
    fallbacks = common.rpc_fallbacks()
    feeds = common.price_feed_contracts()

    targets = [a for a in actions if a.get("action") == "SetWormholeAddress"]
    if not targets:
        raise SystemExit("no SetWormholeAddress actions in this proposal")

    jobs = [
        (
            a["chain"], a["chain_id"], "0x" + a["body"],
            endpoints(a["chain"], chains_meta, fallbacks),
            feeds.get(a["chain"]), args.skip_before,
        )
        for a in targets
    ]
    print(f"querying {len(jobs)} chains ...")
    results = {r["chain"]: r for r in common.parallel(check_chain, jobs)}

    ok = [r for r in results.values() if r.get("guardians")]
    failed = [r for r in results.values() if not r.get("guardians")]

    # 2C: guardian set match, order-sensitive
    mismatched = [r["chain"] for r in ok if r["guardians"] != ["0x" + g for g in exp_guardians]]
    # 2A: contract chainId must equal the governance target chain
    chain_id_bad = [
        (r["chain"], r["chain_id"], r.get("wormhole_chain_id"))
        for r in ok
        if r.get("wormhole_chain_id") != r["chain_id"]
    ]
    indices = {r["guardian_set_index"] for r in ok}

    print(f"\n--- results ---")
    print(f"chains queried              : {len(results)}")
    print(f"guardian set readable       : {len(ok)}")
    print(f"guardian set MATCHES expected: {len(ok) - len(mismatched)}/{len(ok)}")
    print(f"guardian set indices seen   : {sorted(indices)}")
    print(f"chainId() consistency       : {'OK' if not chain_id_bad else 'MISMATCH'}")

    if not args.skip_before:
        changing = [r["chain"] for r in ok if r.get("wormhole_changes")]
        before_counts = {}
        for r in ok:
            if r.get("current_guardians") is not None:
                n = len(r["current_guardians"])
                before_counts[n] = before_counts.get(n, 0) + 1
        print(f"wormhole address changes on : {len(changing)}/{len(ok)} chains")
        print(f"pre-upgrade guardian counts : {before_counts}")

    # SetDataSources cross-check
    ds_actions = [a for a in actions if a.get("action") == "SetDataSources"]
    ds_bad = []
    for a in ds_actions:
        b = bytes.fromhex(a["body"])
        count, off, srcs = b[0], 1, []
        for _ in range(count):
            srcs.append((int.from_bytes(b[off:off + 2], "big"), b[off + 2:off + 34].hex()))
            off += 34
        want = (expected["data_source"]["emitter_chain"], expected["data_source"]["emitter_address"])
        if srcs != [want]:
            ds_bad.append((a["chain"], srcs))
    if ds_actions:
        print(f"SetDataSources matches expected: {len(ds_actions) - len(ds_bad)}/{len(ds_actions)}")

    problems = bool(failed or mismatched or chain_id_bad or ds_bad or len(indices) > 1)
    if failed:
        print("\nUNREADABLE:")
        for r in failed:
            print(f"  {r['chain']:26} {r['errors'][:1]}")
    if mismatched:
        print("\nGUARDIAN SET MISMATCH:")
        for c in mismatched:
            print(f"  {c}")
            print(f"    got : {results[c]['guardians']}")
            print(f"    want: {['0x' + g for g in exp_guardians]}")
    if chain_id_bad:
        print("\nchainId() MISMATCH (governance target vs contract):")
        for c, want, got in chain_id_bad:
            print(f"  {c}: message targets {want}, contract reports {got}")
    if ds_bad:
        print("\nUNEXPECTED DATA SOURCES:")
        for c, srcs in ds_bad:
            print(f"  {c}: {srcs}")

    if args.out:
        json.dump(
            {"expected": expected, "quorum_required": need, "results": results},
            open(args.out, "w"), indent=2,
        )
        print(f"\nwrote {args.out}")

    print("\nRESULT:", "FAIL" if problems else "PASS")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

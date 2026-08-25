#!/usr/bin/env python3
"""Decode a Squads (mesh) governance proposal into its Pyth governance actions.

Reads the proposal straight off Solana mainnet and derives every instruction
account itself, so the output does not depend on the proposals UI.

Usage:
    python3 decode_proposal.py <proposal-account> [--out actions.json]
"""

import argparse
import hashlib
import json
import struct
import sys
import urllib.request

import common

MESH_PROGRAM = "SMPLVC8MxZ5Bf5EfF7PaMiTCxoBAcmkbM2vkrvMK8ho"
WORMHOLE_PROGRAM = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
DEFAULT_RPC = "https://api.mainnet-beta.solana.com"

MODULES = {0: "Executor", 1: "Target", 2: "EvmExecutor", 3: "Lazer", 4: "StellarExecutor"}
TARGET_ACTIONS = {
    0: "UpgradeContract", 1: "AuthorizeGovernanceDataSourceTransfer",
    2: "SetDataSources", 3: "SetFee", 4: "SetValidPeriod",
    5: "RequestGovernanceDataSourceTransfer", 6: "SetWormholeAddress",
    7: "SetFeeInToken", 8: "SetTransactionFee", 9: "WithdrawFee",
}

B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58decode(s):
    num = 0
    for ch in s:
        num = num * 58 + B58.index(ch)
    raw = num.to_bytes(32, "big") if num else b"\0" * 32
    pad = len(s) - len(s.lstrip("1"))
    return b"\0" * pad + raw[-(32 - pad):] if pad else raw


def b58encode(b):
    num = int.from_bytes(b, "big")
    out = ""
    while num:
        num, rem = divmod(num, 58)
        out = B58[rem] + out
    return "1" * (len(b) - len(b.lstrip(b"\0"))) + out


# --- ed25519 on-curve test, needed to reject PDA candidates that are real keys
P = 2**255 - 19
D = (-121665 * pow(121666, P - 2, P)) % P


def _on_curve(b):
    y = int.from_bytes(b, "little")
    sign = y >> 255
    y &= (1 << 255) - 1
    if y >= P:
        return False
    u = (y * y - 1) % P
    v = (D * y * y + 1) % P
    xx = u * pow(v, P - 2, P) % P
    x = pow(xx, (P + 3) // 8, P)
    if (x * x - xx) % P != 0:
        x = x * pow(2, (P - 1) // 4, P) % P
    if (x * x - xx) % P != 0:
        return False
    if x == 0 and sign:
        return False
    return True


def find_program_address(seeds, program_id):
    for bump in range(255, -1, -1):
        h = hashlib.sha256()
        for s in seeds:
            h.update(s)
        h.update(bytes([bump]))
        h.update(b58decode(program_id))
        h.update(b"ProgramDerivedAddress")
        cand = h.digest()
        if not _on_curve(cand):
            return b58encode(cand), bump
    raise ValueError("no PDA found")


def ix_pda(tx_account, index, program_id=MESH_PROGRAM):
    return find_program_address(
        [b"squad", b58decode(tx_account), struct.pack("<B", index), b"instruction"],
        program_id,
    )[0]


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, body, common.UA)
    res = json.load(urllib.request.urlopen(req, timeout=60))
    if "error" in res:
        raise SystemExit(f"rpc {method}: {res['error']}")
    return res["result"]


def get_account(url, addr):
    import base64
    v = rpc(url, "getAccountInfo", [addr, {"encoding": "base64"}])["value"]
    if v is None:
        raise SystemExit(f"account {addr} not found")
    return base64.b64decode(v["data"][0]), v["owner"]


def get_accounts(url, addrs):
    import base64
    out = []
    for i in range(0, len(addrs), 100):
        vals = rpc(url, "getMultipleAccounts", [addrs[i : i + 100], {"encoding": "base64"}])["value"]
        for a, v in zip(addrs[i : i + 100], vals):
            if v is None:
                raise SystemExit(f"instruction account {a} not found")
            out.append(base64.b64decode(v["data"][0]))
    return out


class Reader:
    def __init__(self, b, off=0):
        self.b, self.o = b, off

    def take(self, n):
        v = self.b[self.o : self.o + n]
        self.o += n
        return v

    def u8(self):
        return self.take(1)[0]

    def u32(self):
        return struct.unpack("<I", self.take(4))[0]

    def pubkey(self):
        return b58encode(self.take(32))


def decode_ms_transaction(data):
    r = Reader(data, 8)  # skip anchor discriminator
    tx = {
        "creator": r.pubkey(),
        "ms": r.pubkey(),
        "transaction_index": r.u32(),
        "authority_index": r.u32(),
        "authority_bump": r.u8(),
        "status": r.u8(),
        "instruction_index": r.u8(),
        "bump": r.u8(),
    }
    for field in ("approved", "rejected", "cancelled"):
        tx[field] = [r.pubkey() for _ in range(r.u32())]
    return tx


def decode_ms_instruction(data):
    r = Reader(data, 8)
    program_id = r.pubkey()
    keys = []
    for _ in range(r.u32()):
        keys.append({"pubkey": r.pubkey(), "is_signer": bool(r.u8()), "is_writable": bool(r.u8())})
    payload = r.take(r.u32())
    return {"program_id": program_id, "keys": keys, "data": payload.hex()}


def wormhole_post_message_payload(data_hex):
    """Extract the message payload from a wormhole post_message instruction."""
    b = bytes.fromhex(data_hex)
    if not b or b[0] != 0x01:
        return None
    n = struct.unpack_from("<I", b, 5)[0]
    return b[9 : 9 + n]


def parse_governance_payload(payload, chain_ids):
    if payload is None or len(payload) < 8 or payload[:4] != b"PTGM":
        return None
    module, action = payload[4], payload[5]
    chain_id = struct.unpack_from(">H", payload, 6)[0]
    name = MODULES.get(module, module)
    act = TARGET_ACTIONS.get(action, action) if module == 1 else action
    return {
        "module": name,
        "action": act,
        "chain_id": chain_id,
        "chain": chain_ids.get(chain_id, f"UNKNOWN({chain_id})"),
        "body": payload[8:].hex(),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("proposal", help="Squads proposal account (base58)")
    ap.add_argument("--rpc", default=DEFAULT_RPC)
    ap.add_argument("--out", help="write decoded actions to this JSON file")
    args = ap.parse_args()

    chain_ids = common.load_chain_ids()
    data, owner = get_account(args.rpc, args.proposal)
    if owner != MESH_PROGRAM:
        print(f"WARNING: account owner is {owner}, expected mesh program {MESH_PROGRAM}", file=sys.stderr)

    tx = decode_ms_transaction(data)
    n = tx["instruction_index"]
    print(f"proposal          : {args.proposal}")
    print(f"  multisig        : {tx['ms']}")
    print(f"  creator         : {tx['creator']}")
    print(f"  transactionIndex: {tx['transaction_index']}")
    print(f"  instructions    : {n}")
    print(f"  approved by     : {len(tx['approved'])} -> {tx['approved']}")

    pdas = [ix_pda(args.proposal, i) for i in range(1, n + 1)]
    raw = get_accounts(args.rpc, pdas)

    actions, non_wormhole = [], 0
    for i, blob in enumerate(raw, start=1):
        ix = decode_ms_instruction(blob)
        entry = {"index": i, "program_id": ix["program_id"]}
        if ix["program_id"] == WORMHOLE_PROGRAM:
            gov = parse_governance_payload(
                wormhole_post_message_payload(ix["data"]), chain_ids
            )
            entry.update(gov or {"raw_data": ix["data"]})
        else:
            non_wormhole += 1
            entry["raw_data"] = ix["data"]
            entry["keys"] = ix["keys"]
        actions.append(entry)

    counts = {}
    for a in actions:
        k = f"{a.get('module')}.{a.get('action')}" if a.get("module") else f"non-wormhole:{a['program_id']}"
        counts[k] = counts.get(k, 0) + 1
    print("\n  action summary:")
    for k, v in sorted(counts.items()):
        print(f"    {k:38} x{v}")
    chains = sorted({a["chain"] for a in actions if a.get("chain")})
    print(f"\n  distinct target chains: {len(chains)}")
    if non_wormhole:
        print(f"  non-wormhole instructions: {non_wormhole}")

    out = {"proposal": args.proposal, "transaction": tx, "actions": actions}
    if args.out:
        json.dump(out, open(args.out, "w"), indent=2)
        print(f"\nwrote {args.out}")
    return out


if __name__ == "__main__":
    main()

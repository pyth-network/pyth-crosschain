# Proposal validation

Scripts for independently validating Pyth governance proposals that move the
price feed contracts onto a different Wormhole contract — the "core -> pro"
upgrade shape, where verification moves from the 19-guardian Wormhole network
to the 5-key Pyth Pro router set.

They read the proposal straight off Solana and the contracts straight off each
chain, so nothing here depends on the proposals UI.

**No install required.** Python 3 stdlib only — no `pnpm install`, no pip
packages. `quick_check.sh` additionally needs foundry's `cast`.

## Usage

```sh
cd contract_manager/scripts/proposal-validation

# 1. decode the proposal into its governance actions
python3 decode_proposal.py 9yuPH43L5ouV4qBKEaZV8TYavZ3TLtePzaEJb4SKWgje --out actions.json

# 2. check every target Wormhole contract and its guardian set
python3 check_guardian_sets.py actions.json --out report.json

# 3. prove a real Pyth Pro VAA actually verifies on all of them
PYTH_API_KEY=... python3 replay_vaa.py report.json --samples 14
```

Each script exits non-zero on any discrepancy, so they can be chained with `&&`.

`quick_check.sh` verifies a handful of chains via `cast` alone, for a reviewer
who does not want to trust the Python.

## What each script does

### `decode_proposal.py`
Fetches the Squads (mesh) transaction account, derives each instruction PDA
itself, and decodes the wrapped Wormhole `post_message` payloads into Pyth
governance actions (`UpgradeContract`, `SetDataSources`, `SetWormholeAddress`,
…). Includes a pure-Python base58 codec and ed25519 on-curve test so PDA
derivation needs no Solana SDK.

### `check_guardian_sets.py`
For every `SetWormholeAddress` action:

- resolves the target contract and checks its `chainId()` equals the chain the
  governance message is addressed to (catches a message aimed at the wrong
  chain's contract);
- reads `getCurrentGuardianSetIndex()` / `getGuardianSet(idx)`;
- compares against the canonical set for the deployment type, **parsed out of
  `contract_manager/src/core/base.ts`** rather than hardcoded, so the check
  tracks the source of truth. The comparison is order-sensitive — guardian
  index matters, since VAA signatures reference guardians by position;
- cross-checks the `SetDataSources` payloads against the same config;
- records the pre-upgrade state (what the Pyth contract points at today) so the
  before/after is explicit.

### `replay_vaa.py`
The strongest check. Fetches a live signed update from the Pyth Pro
Core-compatible (Hermes) API and calls `parseAndVerifyVM()` on every target
contract. Comparing guardian addresses proves the keys are right; this proves
the contract actually *accepts* production traffic.

It doubles as a **quorum check**. Two quorum rules exist in this repo:

| implementation | rule | signatures needed at n=5 |
| --- | --- | --- |
| `ReceiverMessages.quorumThreshold` | `(((n*10)/3)*2)/10 + 1` (2/3) | 4 |
| `ReceiverImplementationHalf.quorumThreshold` | `n/2 + 1` (majority) | 3 |

Pyth Pro signs **3-of-5**. A contract deployed with the 2/3 variant would
reject every price update — an address-only comparison would not catch it, but
the replay does.

It also recovers the signers locally (pure-Python keccak256 + secp256k1
recovery, verification-only) and checks each recovered address sits at its
expected guardian index. Because quorum is 3-of-5, a single sample only shows 3
routers; use `--samples 14` or so to observe all 5.

## `rpc_fallbacks.json`

Some `rpcUrl` values in `src/store/chains/EvmChains.json` reject scripted
access (HTTP 403) or rate-limit hard. This file lists backup endpoints tried in
order after the store URL. Add entries here rather than editing the store.

## Notes

- These are read-only: every call is `eth_call` / `getAccountInfo`. Nothing
  signs or sends a transaction.
- The chain-id registry is parsed from
  `governance/xc_admin/packages/xc_admin_common/src/chains.ts`. Ids that Pyth
  reuses from Wormhole rather than redefining (e.g. 30 = base) come from a
  small table in `common.py`; extend it if a proposal targets an id that
  resolves as `UNKNOWN(<id>)`.

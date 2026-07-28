# EVM legacy → pro-compatible in-place upgrade

Plan for upgrading existing (legacy / `stable`) Pyth Core contracts **in place** so they accept Pyth Pro–signed payloads, while keeping the consumer-facing Pyth proxy address unchanged.

This is the DAO “automatic upgrade” path described in the developer hub (as opposed to early adopters swapping to the side-by-side pro-compatible proxy address).

## Goal

| Keep | Change |
| --- | --- |
| Legacy Pyth **proxy** address (what consumers call) | Wormhole used for verification → pro-compatible receiver |
| Same Pyth ABI / feed IDs | Valid data sources → Pro emitter |
| | Quorum 2/3+1 → 1/2+1 (via the pro wormhole, not Pyth itself) |

### What “Pro routers” means here

**Pyth Pro routers are off-chain signers**, not contracts. Five routers produce and ECDSA-sign price Merkle roots (same signature scheme as Wormhole guardians). The on-chain Wormhole receiver only stores their **public keys** as its guardian set (`initialGuardianSet` in `getDefaultDeploymentConfig("pro-compatible-*")`) and enforces half quorum (3/5). Hermes gathers those signatures; the receiver verifies them.

## Storage model (why a migrate action is needed)

The consumer address is an ERC1967 **proxy**. Calls `delegatecall` into `PythUpgradable`; **all runtime state lives in the proxy**:

| Location | What it holds |
| --- | --- |
| Pyth proxy (ERC1967 slot) | Implementation address |
| Pyth proxy `_state` | `wormhole` address, `validDataSources`, prices, fees, governance emitter, sequences, … |
| Wormhole receiver proxy | Guardian pubkeys, quorum logic (via `ReceiverImplementation` / `Half`) |

Deploying a new wormhole receiver (with the correct guardian set) does **not** update the legacy Pyth proxy’s `_state.wormhole`. A bare `UpgradeContract` only swaps implementation bytecode; proxy storage is unchanged.

`validDataSources` also differ in config: stable uses three Pythnet/Solana emitters; pro-compatible uses a single emitter (`PythnetPythnetPythnetPythnetPyth` on chain 26). `governanceDataSource` for `pro-compatible-production` matches `stable`.

## Why not the obvious governance actions

- **`SetWormholeAddress` exists** (action 6) but is insufficient for a Pro-guardian wormhole: the cutover VAA is verified against the *current* wormhole, then `setWormholeAddress` re-verifies the *same* VAA against the *new* wormhole. That requires overlapping guardian sets.
- **Guardian-set upgrade VAAs on the Wormhole receiver are not available** for moving to Pro routers (receiver governance only supports `submitNewGuardianSet` from Wormhole governance).
- **The legacy Wormhole receiver cannot be flipped to half-quorum in place**: quorum lives in `ReceiverImplementationHalf`, and `ReceiverGovernance` has no contract-upgrade path.
- **Migrate cannot run inside the first `UpgradeContract`**: that action executes on the *current* (legacy) implementation, which always calls `_upgradeToAndCallUUPS(impl, "", false)`. Atomic upgrade+migrate in one VAA is not possible without a prior impl that already knows how to pass migrate calldata.

Therefore: leave the legacy wormhole unused, reuse (or deploy) a **pro-compatible wormhole receiver**, then on the **legacy Pyth proxy**: (1) `UpgradeContract` to a new impl that understands a new governance action, (2) that action writes wormhole + data sources + fee=`0` **without** dual-VAA verify.

## Architecture (after cutover)

```text
Consumer ──► legacy Pyth proxy (same address)
                │  implementation: new PythUpgradable (adds migrate governance action)
                │  storage.wormhole ──► pro-compatible WormholeReceiver
                │                       (ReceiverImplementationHalf + Pro router pubkeys)
                │  storage.dataSources ──► Pro emitter
                │
                └── (legacy WormholeReceiver left in place, unused)
```

## Agreed implementation: 1 impl deploy + 2 governance actions

Per chain:

1. **Deploy** one new `PythUpgradable` implementation (normal deploy tx; not a new proxy).
2. **Governance VAA₁ — `UpgradeContract`:** point the legacy proxy at that implementation.
3. **Governance VAA₂ — `SetWormholeAddressAndDataSources` (action 10):** set `_state.wormhole`, replace `validDataSources`, set single-update fee to `0`.

Both VAAs still verify on the **legacy** wormhole (pointer unchanged until VAA₂). They can be one vault proposal with two wormhole messages; execute in order. After VAA₂, further governance must verify on the pro wormhole.

### New governance action: `SetWormholeAddressAndDataSources` (action id **10**)

Locked name/id for Solidity, `xc_admin_common`, and contract_manager. Fee is **required** in the payload (always set to `0`/`0` for this migration).

Payload (fee is **required**, always set to `0` for this migration):

| Field | Layout | Value |
| --- | --- | --- |
| `newWormholeAddress` | `address(20)` | pro-compatible receiver from step 1 below |
| `dataSources[]` | `num(u8) ‖ [chain(u16be) ‖ emitter(32)]*` | Pro emitter from `getDefaultDeploymentConfig("pro-compatible-production")` |
| `newFeeValue` / `newFeeExpo` | `u64be ‖ u64be` | `0` / `0` (fee = value × 10^expo) — **always included** |

Full wire format (Target module):

```text
PTGM(4) | module=1(1) | action=10(1) | targetChainId(u16be) |
  newWormholeAddress(20) |
  numSources(u8) | [emitterChain(u16be) | emitterAddress(32)]* |
  newFeeValue(u64be) | newFeeExpo(u64be)
```

Behavior:

- `setWormhole(newWormhole)` **without** the dual-VAA re-verify used by `SetWormholeAddress`
- Same data-source replacement logic as existing `setDataSources`
- Always set single-update fee to `0` (same logic as existing `setFee`)
- Emit existing `WormholeAddressSet` / `DataSourcesSet` / `FeeSet`
- Light sanity checks: non-zero address, `extcodesize > 0`, optionally `chainId()` doesn’t revert

Governance is already trusted; the action need not be one-shot (unlike an earlier draft). Bundling wormhole + data sources + fee in **one** action avoids a half-migrated proxy.

**Do not** change existing `SetWormholeAddress` (action 6) to drop dual-verify — keep that safety rail for normal use.

## Steps (per chain)

### 1. Ensure a pro-compatible Wormhole receiver exists

- If the store already has a `pro-compatible-production` (or staging) wormhole for the chain → **reuse it**.
- Otherwise deploy a **full** receiver (not only `ReceiverImplementationHalf`):
  - `ReceiverSetup`
  - `ReceiverImplementationHalf`
  - `WormholeReceiver` proxy, initialized with Pro router **public keys** as the guardian set and half quorum
  - Same path as `deployWormholeContract` / `getOrDeployWormholeContract` with pro-compatible deployment config.

### 2. Deploy a new `PythUpgradable` implementation

- Implementation only (same pattern as `upgrade_evm_pricefeed_contracts.ts`).
- Do **not** deploy a new `ERC1967Proxy` for the in-place path.
- New code must parse/handle the migrate governance action (id 10).

### 3. Propose governance (legacy proxy)

- VAA₁: `UpgradeContract` → implementation from step 2.
- VAA₂: `SetWormholeAddressAndDataSources` with pro wormhole + Pro data sources + fee `0`.

### 4. Execute VAAs in order on the legacy proxy

- Verify post-state: `wormhole()`, `validDataSources()`, fee == `0`, and that a Pro Hermes update verifies.

### 5. Hermes / ops cutover

- On-chain migrate (VAA₂) must complete **before** `hermes.pyth.network` starts serving Pro payloads for that chain.
- Brief dual-fetch window for consumers who wait for automatic upgrade (documented in developer hub).

## What we are not doing (this path)

| Approach | Why not |
| --- | --- |
| Deploy a new Pyth **proxy** and tell consumers to swap | Early-upgrade path; new address |
| `SetWormholeAddress` (action 6) to the pro wormhole | Dual-verify against both guardian sets fails |
| Guardian-set VAA on legacy or pro wormhole | Cannot produce / not available for Pro routers |
| Upgrade legacy Wormhole receiver implementation | No governance upgrade path on receiver |
| Migrate via `upgradeToAndCall` in the first `UpgradeContract` | Legacy `upgradeUpgradableContract` always passes empty calldata |

## How governance instructions are sent today

Deploy (`deploy_evm_pricefeed_contracts.ts`) does **not** use governance — init sets wormhole / data sources / fees in one tx. Governance is only for post-deploy changes.

```text
contract_manager script
  → encode Buffer[] via @pythnetwork/xc-admin-common
  → Vault.proposeWormholeMessage(payloads)
  → Squads vault posts N Wormhole messages on Solana
  → guardians attest → VAAs
  → executeGovernanceInstruction(vaa) on each EVM chain
```

Closest patterns:

| Script | What it proposes |
| --- | --- |
| `upgrade_evm_pricefeed_contracts.ts` | Deploy impl → N× `UpgradeContract` in one proposal |
| `batchDeployReceivers.ts` | Deploy receivers → N× `SetWormholeAddress` (action 6) — **not usable for Pro migrate** (dual-verify) |
| `generate_governance_set_fee_payload.ts` | N× `SetFee` |

`proposeWormholeMessage(Buffer[])` already supports multiple different actions in one proposal. Order in the array becomes VAA sequence order → use `[UpgradeContract, Migrate]` per chain.

Payload builders live on `EvmChain` (`generateGovernanceUpgradePayload`, `generateGovernanceSetWormholeAddressPayload`, …) and wrap `xc_admin_common` classes. Action IDs are in `TargetAction` (`PythGovernanceAction.ts`); next free id is **10**.

## Code / tooling work

### 1. Solidity

- Add action 10 enum + payload parser in `PythGovernanceInstructions.sol`
- Handler in `PythGovernance.sol`: set wormhole (no dual-verify) + data sources + fee `0`; emit existing events
- Forge tests: happy path, rejects zero/empty code, data sources + fee updated, old `SetWormholeAddress` unchanged

### 2. `xc_admin_common` (governance encoding)

xc_admin does **not** talk to EVM RPCs for Target actions — it encodes/decodes payloads and proposes Wormhole messages from the Squads vault.

Required changes:

1. **`governance_payload/PythGovernanceAction.ts`**
   - Add to `TargetAction`: `SetWormholeAddressAndDataSources: 10`
   - Add `case 10` in `toActionName`
2. **New codec** `governance_payload/SetWormholeAddressAndDataSources.ts`
   - Variable-length (like `SetDataSources`), not a fixed `layout`
   - Constructor: `(targetChainId, address /* 20-byte hex without 0x */, dataSources, newFeeValue, newFeeExpo)`
   - Body must match Solidity byte-for-byte:
     ```text
     newWormholeAddress(20)
     || numSources(u8) || [chain(u16be)||emitter(32)]*
     || newFeeValue(u64be) || newFeeExpo(u64be)   // always present; migrate uses 0/0
     ```
3. **`governance_payload/index.ts`** — import + `case` in `decodeGovernancePayload` + re-export
4. **Tests** — encode/decode roundtrip in `__tests__/GovernancePayload.test.ts`
5. **Optional UX** — `xc_admin_frontend` proposal summary so action 10 is not `"unknown"`

No changes needed to crank / vault multi-message machinery, or to action 6.

### 3. Contract manager

1. **`EvmChain.generateGovernanceSetWormholeAddressAndDataSourcesPayload(address, dataSources, feeValue, feeExpo)`** wrapping the new codec (fee args always passed; migrate script hardcodes `0n`/`0n`)
2. **Script** `migrate_evm_pricefeed_to_pro.ts`, modeled on upgrade + `batchDeployReceivers`:
   - resolve or deploy pro wormhole via `getOrDeployWormholeContract`
   - deploy new Pyth implementation
   - build `[UpgradeContract, SetWormholeAddressAndDataSources]` payloads for the **legacy** proxy
   - `vault.proposeWormholeMessage(payloads)`
3. **`check_proposal.ts`** — assert upgrade target and migrate targets (pro wormhole, Pro data sources, fee `0`)
4. **Store** — after execution, note that the legacy proxy entry is now pro-compatible; keep historical wormhole pointer clear for ops

Example proposal shape:

```ts
payloads.push(chain.generateGovernanceUpgradePayload(newImpl));
payloads.push(
  chain.generateGovernanceSetWormholeAddressAndDataSourcesPayload(
    proReceiver.replace("0x", ""),
    proDataSources,
    0n,
    0n,
  ),
);
await vault.proposeWormholeMessage(payloads);
```

## Suggested rollout order

1. Implement + forge-test the new action and upgrade→migrate sequence on a single testnet.
2. Dry-run script: deploy/reuse wormhole → deploy impl → propose both VAAs → execute → verify Pro update.
3. Mainnet chain batch(es) with proposal checklist and post-execute verification.
4. Coordinate Hermes redirect with on-chain completion.

## Related files

- `contract_manager/src/core/base.ts` — `DeploymentType`, `getDefaultDeploymentConfig`
- `contract_manager/scripts/common.ts` — `getOrDeployWormholeContract`, `deployWormholeContract`
- `contract_manager/scripts/deploy_evm_pricefeed_contracts.ts` — full proxy deploy (side-by-side)
- `contract_manager/scripts/upgrade_evm_pricefeed_contracts.ts` — impl deploy + `UpgradeContract` (no migrate today)
- `target_chains/ethereum/contracts/contracts/pyth/PythUpgradable.sol`
- `target_chains/ethereum/contracts/contracts/pyth/PythGovernance.sol` — `SetWormholeAddress` dual-verify
- `target_chains/ethereum/contracts/contracts/pyth/PythState.sol` — proxy storage layout
- `target_chains/ethereum/contracts/contracts/wormhole-receiver/ReceiverImplementationHalf.sol`
- `governance/xc_admin/packages/xc_admin_common/src/governance_payload/` — action codecs
- `apps/developer-hub/content/docs/price-feeds/core/upgrade/` — consumer-facing docs

# Pyth Lazer Stellar Contracts

Soroban smart contracts for verifying [Pyth Lazer](https://docs.pyth.network/lazer) price feed updates on the [Stellar](https://stellar.org) network.

## Architecture

```
                        Wormhole Guardians
                              |
                         sign VAAs
                              |
                              v
┌──────────────────────────────────────────┐
│         wormhole-executor-stellar        │
│                                          │
│  - Verifies Wormhole VAA signatures      │
│  - Manages guardian sets                 │
│  - Parses PTGM governance payloads       │
│  - Dispatches governance to target       │
└────────────────┬─────────────────────────┘
                 │ cross-contract call
                 │ (update_trusted_signer / upgrade)
                 v
┌──────────────────────────────────────────┐
│          pyth-lazer-stellar              │
│                                          │
│  - Verifies LE-ECDSA signed updates      │
│  - Manages trusted signers (via executor)│
│  - Parses structured price feed payloads │
│  - Returns verified payload to caller    │
└──────────────────────────────────────────┘
                 ^
                 │ verify_update(data)
                 │
            Consumer dApp
```

**Flow:**
1. Wormhole governance VAAs add/remove trusted Lazer signers via the executor
2. Lazer publishes LE-ECDSA signed price updates off-chain
3. Consumer dApps submit updates to `pyth-lazer-stellar.verify_update()` to get verified price data

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- Soroban target: `rustup target add wasm32-unknown-unknown`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) (for deployment)

## Build

```bash
make build
```

This compiles both contracts to WASM targeting `wasm32-unknown-unknown`.

## Test

```bash
make test
```

Runs all unit tests and integration tests. The integration test suite (`contracts/integration-tests`) exercises:

- Full governance flow: VAA -> executor -> Lazer contract (add/update/remove signers)
- Full verification flow: signed Lazer update -> verify -> parse payload (BTC, ETH, SOL feeds)
- Upgrade governance dispatch
- Guardian set upgrades followed by governance actions
- Negative cases: expired signers, wrong emitter, replayed VAAs, unauthorized calls, invalid PTGM

## End-to-End Test

Run the E2E test against the testnet deployment:

```bash
cd scripts/e2e
PYTH_LAZER_TOKEN=<your-token> npx tsx src/test_real_update.ts \
  --contract-id CCE62RN3NUTNMD2SQ2EGWRJ6XHL7RUYQBNCEK7LVGFRLPCW7U7FGACM5
```

This fetches a real signed price update from the Pyth Lazer service and verifies it on-chain.

## Code Quality

```bash
make fmt        # Format code
make fmt-check  # Check formatting (CI)
make clippy     # Run clippy lints
make check      # fmt-check + clippy + test
```

## Project Structure

```
lazer/contracts/stellar/
├── Cargo.toml                          # Workspace root
├── Makefile
├── README.md
├── contracts/
│   ├── pyth-lazer-stellar/             # Lazer verification contract
│   │   └── src/
│   │       ├── lib.rs                  # Contract entry points
│   │       ├── verify.rs               # LE-ECDSA signature verification
│   │       ├── payload.rs              # Price feed payload parsing
│   │       ├── state.rs                # Storage management
│   │       └── error.rs                # Error types
│   ├── wormhole-executor-stellar/      # Wormhole governance executor
│   │   └── src/
│   │       ├── lib.rs                  # Contract entry points
│   │       ├── vaa.rs                  # VAA parsing & verification
│   │       ├── governance.rs           # PTGM parsing
│   │       ├── guardian.rs             # Guardian set management
│   │       └── error.rs               # Error types
│   └── integration-tests/             # Cross-contract integration tests
│       └── src/
│           └── test.rs
```

## Testnet Deployment

| Contract | Address |
|----------|---------|
| Pyth Lazer | `CCE62RN3NUTNMD2SQ2EGWRJ6XHL7RUYQBNCEK7LVGFRLPCW7U7FGACM5` |

The testnet contract is initialized with the Pyth Lazer trusted signer and ready for use.

## Deployment

### Testnet

1. Configure Stellar CLI for testnet:

```bash
stellar keys generate deployer --network testnet
```

2. Build the WASM binaries:

```bash
make build
```

3. Deploy the Wormhole executor contract:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/wormhole_executor_stellar.wasm \
  --network testnet \
  --source deployer
```

4. Initialize the executor with the Wormhole guardian set:

```bash
stellar contract invoke \
  --id <EXECUTOR_CONTRACT_ID> \
  --network testnet \
  --source deployer \
  -- initialize \
  --chain_id 30 \
  --owner_emitter_chain 1 \
  --owner_emitter_address <GOVERNANCE_EMITTER_ADDRESS> \
  --initial_guardian_set '["<GUARDIAN_ETH_ADDR_1>", ...]' \
  --guardian_set_index <CURRENT_INDEX>
```

5. Deploy the Pyth Lazer contract:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/pyth_lazer_stellar.wasm \
  --network testnet \
  --source deployer
```

6. Initialize the Lazer contract with the executor address:

```bash
stellar contract invoke \
  --id <LAZER_CONTRACT_ID> \
  --network testnet \
  --source deployer \
  -- initialize \
  --executor <EXECUTOR_CONTRACT_ID>
```

### Mainnet

Follow the same steps as testnet, replacing `--network testnet` with `--network mainnet` and using production guardian set values.

## Configuration

| Parameter | Description |
|-----------|-------------|
| `chain_id` | Wormhole chain ID for Stellar (30) |
| `owner_emitter_chain` | Wormhole chain ID of the governance emitter (1 = Solana) |
| `owner_emitter_address` | 32-byte Wormhole emitter address for governance |
| `initial_guardian_set` | List of 20-byte Ethereum addresses of Wormhole guardians |
| `guardian_set_index` | Current guardian set index from Wormhole |

See [Wormhole contract addresses](https://wormhole.com/docs/products/reference/contract-addresses) and [chain IDs](https://wormhole.com/docs/products/reference/chain-ids) for reference values.

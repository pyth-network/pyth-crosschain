# Integration Testing with Yaci DevKit

The integration tests run against a local Cardano devnet powered by
[Yaci DevKit](https://github.com/bloxbean/yaci-devkit). This guide covers
installing Yaci, starting a devnet, and running the tests.

## Prerequisites

- **Docker** installed and running
- **Node.js** (v18+) and npm
- Ports **3001**, **8080**, **5173**, and **10000** must be free

## Quick start

After installing the prerequisites:

```bash
# 1. Install Yaci DevKit
curl --proto '=https' --tlsv1.2 -LsSf https://devkit.yaci.xyz/install.sh | bash

# 2. Start devkit containers (first time pulls Docker images)
devkit start

# 3. In another terminal — create devnet, fund wallet, and run tests
cd lazer/contracts/cardano
./scripts/setup-devnet.sh
cd typescript && npm install && npm test
```

## What the setup script does

`scripts/setup-devnet.sh` automates devnet setup via the Yaci admin REST API
(port 10000):

1. Checks if devkit containers are running (starts them if not)
2. Creates a devnet node (`POST /local-cluster/api/admin/devnet/create`)
3. Waits for the Yaci Store API to be ready on port 8080
4. Funds the test wallet with 10,000 ADA (`POST /local-cluster/api/addresses/topup`)
5. Waits for the funds to appear on-chain

The test wallet uses a deterministic mnemonic, so its address is always:

```
addr_test1qryvgass5dsrf2kxl3vgfz76uhp83kv5lagzcp29tcana68ca5aqa6swlq6llfamln09tal7n5kvt4275ckwedpt4v7q48uhex
```

## Running the tests

```bash
cd lazer/contracts/cardano/typescript
npm test
```

The integration tests:

1. **Register staking address** -- one-time registration of the price validator's
   staking credential.
2. **Mint signer NFT** -- creates the signer NFT with an initial signing policy.
3. **Verify price** -- submits a price verification transaction using the
   withdraw-0 trick.
4. **Update signer set** -- spends the signer NFT UTxO and recreates it with an
   updated signing policy datum.
5. **Burn signer NFT** -- destroys the signer NFT.

Each test waits 2 seconds after submission for the block to be confirmed and
indexed.

## Skipping integration tests

To run only the unit tests (no devnet required):

```bash
SKIP_INTEGRATION=1 npm test
```

## Resetting the devnet

If the devnet state becomes inconsistent (e.g., the NFT was burned in a previous
run), reset and re-setup:

```bash
cd lazer/contracts/cardano
./scripts/setup-devnet.sh
```

The script creates a fresh devnet each time. To fully reset the containers:

```bash
devkit stop
devkit start
# then in another terminal:
./scripts/setup-devnet.sh
```

## Stopping the devnet

```bash
devkit stop
```

## Manual setup (alternative)

If you prefer to set up the devnet manually instead of using the script:

1. Start devkit: `devkit start`
2. In the yaci-cli prompt: `create-node -o --start`
3. Fund the wallet: `topup addr_test1qryvgass5dsrf2kxl3vgfz76uhp83kv5lagzcp29tcana68ca5aqa6swlq6llfamln09tal7n5kvt4275ckwedpt4v7q48uhex 10000`

## Troubleshooting

**`ECONNREFUSED` on port 8080** -- The devkit containers aren't running. Run
`devkit start` and then `./scripts/setup-devnet.sh`.

**`UTxO Balance Insufficient`** -- The test wallet doesn't have enough ADA.
Re-run `./scripts/setup-devnet.sh` to reset and re-fund.

**`OutsideValidityIntervalUTxO`** -- The validity range is stale. This
shouldn't happen with the current test code (it queries the current slot
dynamically), but if it does, check that the devnet is producing blocks.

**`StakeKeyRegisteredDELEG`** -- The staking credential was already registered.
This is handled automatically and is not a real failure.

**`NoCollateralInputs`** -- Plutus script transactions require collateral.
The test code sets collateral from wallet UTxOs automatically.

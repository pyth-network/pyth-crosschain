# Pre-requisites

Install aptos cli with the same version specified in the ci workflows.

All the commands which submit transactions require an environment variable `APTOS_PRIVATE_KEY` for the private key to be set.

# Deploying from scratch

In addition to the wormhole dependency we depend on the deployer contract that facilitates the ownership of package upgrade
capability. You can read more about it [here](https://github.com/wormhole-foundation/wormhole/blob/5255e933d68629f0643207b0f9d3fa797af5cbf7/aptos/deployer/sources/deployer.move).

Assuming the wormhole and deployer contracts are already deployed, we can deploy the pyth oracle with the following command:

```bash
npm run cli deploy-pyth -- ../contracts <seed> \
-n aptos_testnet \
--deployer <deployer-address> \
--wormhole <wormhole-address>
```

`seed` can be any random string that is used for determining a specific contract address based on the seed value and the signer address.

You can manually specify the address of wormhole and deployer contracts with `--wormhole` and `--deployer` flags.
This requires the addresses to be empty in the `Move.toml` file for the pyth package:

```toml
[addresses]
pyth = "_"
deployer = "_"
wormhole = "_"
```

### Initializing pyth

You can run the following to initialize the pyth contract:

```bash
npm run cli init-pyth -- <seed> -n <network> \
--stale-price-threshold 60 \
--update-fee 1 \
--channel <stable-or-beta>
```

# Upgrade process:

The following steps are needed to upgrade our aptos contracts:

- Generate the hash for the new contract build
- Create a governance proposal, proposing the aptos package to be upgraded to this specific hash
- Approve and execute the governance proposal
- Submit the created wormhole VAA to the contract to allow an upgrade with the specified hash.
- Run the upgrade transaction and publish the new package

## Generating the new contract hash:

Run the following command to generate the new hash, this will assume the default deployed addresses of deployer, wormhole, and pyth, but you can override them if necessary.

```bash
npm run cli hash-contracts -- ../contracts
```

## Creating a proposal

Here are sample steps you can take to create a proposal via the contract manager shell (`npm run shell` in contract manager package):

```js
let wallet = await loadHotWallet("/path/to/solana/wallet.json");
let vault =
  DefaultStore.vaults.devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3;
await vault.connect(wallet);
let payload =
  DefaultStore.chains.aptos_testnet.generateGovernanceUpgradePayload(
    "CONTRACT_HASH_TO_USE",
  );
await vault.proposeWormholeMessage([payload]);
```

## VAA submission

After the approval process, you can fetch the VAA for the transaction and execute it by running:

```js
import { SubmittedWormholeMessage } from "./src/governance";
let msg = await SubmittedWormholeMessage.fromTransactionSignature(
  "tx_signature",
  "devnet or mainnet-beta",
);
let vaa = await msg.fetchVaa();
let contract =
  DefaultStore.contracts
    .aptos_testnet_0x7e783b349d3e89cf5931af376ebeadbfab855b3fa239b7ada8f5a92fbea6b387;
await contract.executeGovernanceInstruction(
  "private-key-of-account-inaptos",
  vaa,
);
```

## Upgrading the contract

To upgrade the contract after the governance vaa was executed run:

```bash
npm run cli upgrade -- ../contracts
```

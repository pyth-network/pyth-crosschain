# Pre-requisites

Install aptos cli with the same version specified in the ci workflows.

All the commands which submit transactions require an environment variable for the private key to be set.
Depending on the network, this can be either `APTOS_LOCALNET_KEY`, `APTOS_TESTNET_KEY` or `APTOS_MAINNET_KEY`.

# Deploying from scratch

In addition to the wormhole dependency we depend on the deployer contract that facilitates the ownership of package upgrade
capability. You can read more about it [here](https://github.com/wormhole-foundation/wormhole/blob/5255e933d68629f0643207b0f9d3fa797af5cbf7/aptos/deployer/sources/deployer.move).

Assuming the wormhole and deployer contracts are already deployed, we can deploy the pyth oracle with the following command:

```bash
ts-node cli.ts deploy-pyth ../../contracts <seed> -n testnet
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

You can run the following to initialize the pyth contract, the following is a sample (testnet) config:

```bash
ts-node cli.ts init-pyth <seed> -n testnet \
--stale-price-threshold 60 \
--update-fee 1 \
--governance-emitter-chain-id 1 \
--governance-emitter-address 63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385 \
--data-source-chain-ids 1 \
--data-source-chain-ids 26 \
--data-source-chain-ids 26 \
--data-source-emitter-addresses f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0 \
--data-source-emitter-addresses a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6 \
--data-source-emitter-addresses e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71
```

# Upgrade process:

The following steps are needed to upgrade our aptos contracts:

- Generate the hash for the new contract build
- Create a governance proposal, proposing the aptos package to be upgraded to this specific hash
- Approve and execute the governance proposal
- Run the upgrade transaction and publish the new package

## Generating the new contract hash:

Run the following command to generate the new hash, this will assume the default deployed addresses of deployer, wormhole, and pyth, but you can override them if necessary.

```bash
ts-node cli.ts hash-contracts ../../contracts
```

## Upgrading the contract

To upgrade the contract after the governance vaa was executed run:

```bash
ts-node cli.ts upgrade ../../contracts
```

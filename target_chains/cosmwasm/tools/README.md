# How to add a new chain for deployment

1. Add the chain name to `ChainId` enum in `chains-manager/chains.ts`
2. Add the network configs to `CHAINS_NETWORK_CONFIG` in `chains-manager/chains.ts`. You can lookup for rpc endpoints in [this repo](https://github.com/cosmos/chain-registry). The `gasPrice` is the `average_gas_price` of the chain + the chain token `denom` (Available in chain-registry `chain.json` file).
3. Add the contract configs to `CHAINS_CONTRACT_CONFIG` in `configs.ts`
4. Add the ChainId either to `getChainIdsForStableDeployment` or `getChainIdsForEdgeDeployment` functions in `helper.ts`
5. If the wormhole contract is not deployed on the target chain run the following command:
```
ts-node src/wormhole-stub.ts --mnemonic "<YOUR_MNEMONIC>" --deploy <stable or edge>
```
6. Deploy the pyth contract:
```
ts-node src/instantiate-pyth.ts --contract-version <X.Y.Z> --mnemonic "<YOUR_MNEMONIC>" --deploy <stable or edge>
```
7. Test the new contract:
```
ts-node src/test.ts --mnemonic "<YOUR_MNEMONIC>" --deploy <stable or edge>
```
8. Commit the new json files to the repo
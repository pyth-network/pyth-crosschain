# How to add a new chain or contract

1. Add the chain information to contract manager `CosmWasmChains.yaml`. You can lookup for rpc endpoints in [this repo](https://github.com/cosmos/chain-registry). The `gasPrice` is the `average_gas_price` of the chain + the chain token `denom` (Available in chain-registry `chain.json` file).
2. If the wormhole contract is not deployed on the target chain run the following command:

   ```
   pnpm instantiate-wormhole --private-key <YOUR_PRIVATE_KEY_HEX> --deploy <stable or edge> --chain <chain>
   ```

   You can re-build the wormhole contract using the scripts given in `wormhole-stub`.
   Run `build.sh` and you will get the compiled contract code in `wormhole-stub/artifacts`

3. Deploy the pyth contract:

   ```
   pnpm instantiate-pyth --contract-version <X.Y.Z> --private-key <YOUR_PRIVATE_KEY_HEX> \
       --deploy <stable or edge> --wormhole <WORMHOLE_CONTRACT_ADDRESS> --chain <chain>
   ```

4. You can test the new contract via contract manager scripts like this:

   ```
   cd ../../../contract_manager
   pnpm exec ts-node scripts/update_pricefeed.ts --private-key <YOUR_PRIVATE_KEY_HEX> --contract <CONTRACT_ID> --feed-id <FEED_ID>
   ```

5. Commit the new entries added to contract manager yaml files
6. Update documentation repos and add the new contract address

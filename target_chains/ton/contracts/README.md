# pyth

## Project structure

- `contracts` - source code of all the smart contracts of the project and their dependencies.
- `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
- `tests` - tests for the contracts.
- `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

First, visit [TON Center](https://toncenter.com/) and register to get an API key to bypass rate limits. Replace `<YOUR-API-KEY>` with the API key you obtained from TON Center. `<CUSTOM-TYPE>` is either `testnet` or `mainnet`. `<CHAIN-ID>` is the chain ID of the chain you want to deploy to.

Then run:

```bash
CHAIN_ID=<CHAIN-ID> npx blueprint run --custom https://testnet.toncenter.com/api/v2/jsonRPC --custom-version v2 --custom-type <CUSTOM-TYPE> --custom-key <YOUR-API-KEY>
```

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`

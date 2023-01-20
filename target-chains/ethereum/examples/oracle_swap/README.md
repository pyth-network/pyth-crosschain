# Transfer USD in ETH to a friend

The contract is currently deployed on `0x7B4b667F9B792054565e10656d1A08ECF50aa31C` on the goerli network.

## Build

You need to have [Foundry](https://getfoundry.sh/) and node installed to run this example.

To build

```
cd ./contract
forge install foundry-rs/forge-std@2c7cbfc6fbede6d7c9e6b17afe997e3fdfe22fef --no-git --no-commit
forge install pyth-network/pyth-sdk-solidity@v1.0.1 --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v4.8.1 --no-git --no-commit
cd ../app/
npm ci
```

## Testing the contract

Simply run `forge test` on [`contract`](./contract) directory. It runs the tests located in
[`contract/test`](./contract/test) directory.

## Deploy and run

```
forge create src/OracleSwap.sol:OracleSwap \
  --rpc-url <GOERLI_RPC> --mnemonic <MNEMONIC_PATH> \
  --constructor-args
  "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C" \
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6"
```

`0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` is the Pyth contract address on Goerli network and
`0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6` is the `ETH/USD` price feed id.

Replace `PYTH_EXAMPLE_ADDRESS` in [`app/src/App.tsx`](./app/src/App.tsx) to the new deployed address.
Finally, run `npm run start` on [`app`](./app) directory to start the UI and interact with your contract.



## Create ABI

```
forge inspect OracleSwap abi
```

deploy a token

```
forge create ERC20Mock --rpc-url https://goerli.optimism.io -l --constructor-args "Brazilian Real" "BRL" "0x4F22ff9e78D9287402cd16be157FF2c28638323e" "0"
```

optimism goerli addresses
brl 0x8e2a09b54fF35Cc4fe3e7dba68bF4173cC559C69
usd 0x98cDc14fe999435F3d4C2E65eC8863e0d70493Df


mint some usd for yourself
```
cast send --rpc-url https://goerli.optimism.io -l 0x98cDc14fe999435F3d4C2E65eC8863e0d70493Df "mint(address,uint256)" 0x4F22ff9e78D9287402cd16be157FF2c28638323e 1000000000000000000
```


working on this command
forge create OracleSwap --rpc-url https://goerli.optimism.io -l --constructor-args "US Dollar" "USD" "0x4F22ff9e78D9287402cd16be157FF2c28638323e" "0"


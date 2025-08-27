# Contract verification

The various EVM explorer sites (etherscan, bscscan, etc.) support contract
verification. This essentially entails uploading the source code to the site,
and they verify that the uploaded source code compiles to the same bytecode
that's actually deployed. This enables the explorer to properly parse the
transaction payloads according to the contract ABI.

Our contracts are structured as a separate proxy (ERC1967) and an implementation. Both of
these components need to be verified.

In each contract release all the assets needed for verification are included.
Most of the explorers accept the standard json-input format, while some only accept a flattened (single file) solidity source code.

## Verifying the contract via explorers

Pyth contract address refers to the proxy contract. After verifying the proxy contract, the implementation contract needs to be verified as well.

Use the verification files in the release to verify the contracts on the explorer sites.
You can find the compiler configurations in [`foundry.toml`](./foundry.toml).
The required configurations are the _solc version_ and the _optimizer runs_.

## Verifying the contract via Foundry or Hardhat

Although, verification via explorers is the recommended way, you can also verify the contracts using Foundry or Hardhat.
In general, you will need an API key for the relevant explorer (this can be obtained by creating an account),
and also know which address the contract code lives. The API key is expected to
be set in the `ETHERSCAN_KEY` environment variable for all APIs (not just etherscan, bit of a misnomer).

```
ETHERSCAN_KEY=... npm run verify --module=PythUpgradable --contract_address=0x0e082F06FF657D94310cB8cE8B0D9a04541d8052 --network=avalanche
```

(Note: In this case, the `ETHERSCAN_KEY` is your snowtrace API key).

For Foundry verification, you can use the built-in verification feature by adding `--verify` to your deployment command:

```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

### Verifying with Hardhat

Some chains might require users to verify with Hardhat. Here are the additional steps:

- Add the chain to `networks` in `hardhat.config.ts`
- Add the explorer parameters to `etherscan` in `hardhat.config.ts`
- Run:

```
MNEMONIC=... pnpm exec hardhat verify 0x354bF866A4B006C9AF9d9e06d9364217A8616E12 --network shimmer_testnet
```

This process is somehow flaky. After running it, check the explorer as sometimes it will work even when it says it failed.

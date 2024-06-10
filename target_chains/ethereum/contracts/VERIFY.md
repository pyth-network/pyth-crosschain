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
You can find the compiler configurations in [`truffle-config.js`](./truffle-config.js) by searching for `compilers`.
The required configurations are the _solc version_ and the _optimizer runs_.

## Verifying the contract via truffle or hardhat

Although, verification via explorers is the recommended way, you can also verify the contracts using truffle or hardhat.
In general, you will need an API key for the relevant explorer (this can be obtained by creating an account),
and also know which address the contract code lives. The API key is expected to
be set in the `ETHERSCAN_KEY` environment variable for all APIs (not just etherscan, bit of a misnomer).

```
ETHERSCAN_KEY=... npm run verify --module=PythUpgradable --contract_address=0x0e082F06FF657D94310cB8cE8B0D9a04541d8052 --network=avalanche
```

(Note: the network name comes from the `truffle-config.json`).
(Note: In this case, the `ETHERSCAN_KEY` is your snowtrace API key).

**You might need to add the explorer api keys in [the truffle config](./truffle-config.js) `api_keys`.** Please look at
`truffle-plugin-verify/utils.js` to find the key names. Here is an example:

```js
{
    compilers: [...],

    api_keys: {
        etherscan: process.env.ETHERSCAN_KEY,
        bscscan: process.env.BSCSCAN_KEY,
        snowtrace: process.env.SNOWTRACE_KEY,
    },

    plugins: [...]
}
```

# Note

The `npm run verify` script uses the `truffle-plugin-verify` plugin under the
hood. The version of `truffle-plugin-verify` pinned in the repo (`^0.5.11` at
the time of writing) doesn't support the avalanche RPC. In later versions of the
plugin, support was added, but other stuff has changed as well in the transitive
dependencies, so it fails to parse the `HDWallet` arguments in our
`truffle-config.json`. As a quick workaround, we backport the patch to `0.5.11`
by applying the `truffle-verify-constants.patch` file, which the `npm run verify` script does transparently. Once the toolchain has been upgraded and the
errors fixed, this patch can be removed.

### Verifying with hardhat

Some chains might require users to verify with hardhat. Here are the additional steps :

- Add the chain to `networks` in `hardhat.config.ts` (equivalent of `truffle-config.js`)
- Add the explorer parameters to `etherscan` in `hardhat.config.ts`
- Run :

```
MNEMONIC=... pnpm exec hardhat verify 0x354bF866A4B006C9AF9d9e06d9364217A8616E12 --network shimmer_testnet
```

This process is somehow flaky. After running it, check the explorer as sometimes it will work even when it says it failed.

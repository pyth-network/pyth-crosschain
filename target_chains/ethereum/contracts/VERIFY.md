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

## Verifying the contract

Pyth contract address refers to the proxy contract. After verifying the proxy contract, the implementation contract needs to be verified as well.

Use the verification files in the release to verify the contracts on the explorer sites.
You can find the compiler configurations in [`truffle-config.js`](./truffle-config.js) by searching for `compilers`.
The required configurations are the _solc version_ and the _optimizer runs_.

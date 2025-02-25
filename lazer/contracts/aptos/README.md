## Pyth Lazer Aptos Contract

This package is built using the Move language and Aptos framework.

`PythLazer` is an Aptos contract that allows consumers to easily verify Pyth Lazer updates for use on-chain.

### Build, test, deploy

Install Aptos CLI and set it up:

```shell
brew install aptos
aptos --version
aptos init --network devnet
```

Compile the contract and run tests:

```shell
aptos move compile
aptos move test
```

Deploy to the network configured in your aptos profile:

```shell
aptos move publish
```

Invoke deployed contract functions on-chain:

```shell
aptos move run --function-id 'default::pyth_lazer::update_trusted_signer' --args 'hex:0x8731685005cfb169b4da4bbfab0c91c5ba59508bbd6d26990ee2be7225cb34d1' 'u64:9999999999'
```

### Error Handling

The contract uses the following error codes:

- ENO_PERMISSIONS (1): Caller lacks required permissions
- EINVALID_SIGNER (2): Invalid or expired signer
- ENO_SPACE (3): Maximum number of signers reached
- ENO_SUCH_PUBKEY (4): Attempting to remove non-existent signer
- EINVALID_SIGNATURE (5): Invalid Ed25519 signature
- EINSUFFICIENT_FEE (6): Insufficient fee provided

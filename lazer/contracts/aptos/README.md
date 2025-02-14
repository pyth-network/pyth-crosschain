## Pyth Lazer Aptos Contract

This package is built using the Move language and Aptos framework.

`PythLazer` is an Aptos on-chain contract that allows consumers to easily verify Pyth Lazer updates for use on-chain.

### Build and Test

```shell
$ aptos move compile
$ aptos move test
```

### Error Handling

The contract uses the following error codes:

- ENO_PERMISSIONS (1): Caller lacks required permissions
- EINVALID_SIGNER (2): Invalid or expired signer
- ENO_SPACE (3): Maximum number of signers reached
- ENO_SUCH_PUBKEY (4): Attempting to remove non-existent signer
- EINVALID_SIGNATURE (5): Invalid Ed25519 signature
- EINSUFFICIENT_FEE (6): Insufficient fee provided

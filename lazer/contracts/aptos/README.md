## Pyth Lazer Aptos Contract

This package is built using the Move language and Aptos framework.

`PythLazer` is an Aptos on-chain contract that keeps track of trusted signers of Pyth Lazer payloads. It allows consumers to easily check validity of Pyth Lazer signatures while enabling key rotation.

### Key Features
- Ed25519 signature verification using Aptos standard library
- Support for up to 2 trusted signers
- Fee collection in Aptos native token
- Signer expiration management

### Build and Test

```shell
$ aptos move compile
$ aptos move test
```

### Implementation Details
- Uses Ed25519 signature verification from Aptos standard library
- Maintains compatibility with Solana/EVM implementations
- Follows Move best practices for resource management
- Collects 1 wei fee per verification in Aptos native token
- Supports maximum of 2 trusted signers (matching Solana implementation)

### Error Handling
The contract uses the following error codes:
- ENO_PERMISSIONS (1): Caller lacks required permissions
- EINVALID_SIGNER (2): Invalid or expired signer
- ENO_SPACE (3): Maximum number of signers reached
- ENO_SUCH_PUBKEY (4): Attempting to remove non-existent signer
- EINVALID_SIGNATURE (5): Invalid Ed25519 signature
- EINSUFFICIENT_FEE (6): Insufficient fee provided

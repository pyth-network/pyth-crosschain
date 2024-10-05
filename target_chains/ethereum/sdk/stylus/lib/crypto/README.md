# Cryptographic Utilities

Common cryptographic procedures for a blockchain environment.

> [!WARNING]
> Note that `crypto` is still `0.*.*`, so breaking changes
> [may occur at any time](https://semver.org/#spec-item-4). If you must depend
> on `crypto`, we recommend pinning to a specific version, i.e., `=0.y.z`.

## Verifying Merkle Proofs

[`merkle.rs`](./src/merkle.rs) provides:

- A `verify` function which can prove that some value is part of a
  [Merkle tree].
- A `verify_multi_proof` function which can prove multiple values are part of a
  [Merkle tree].

[Merkle tree]: https://en.wikipedia.org/wiki/Merkle_tree

## Feature Flags

This crate exposes its modules behind feature gates to ensure the bare minimum
is included in consumer codebases. You can check the current feature flags in
the [Cargo.toml](./Cargo.toml) file.

## Security

> [!WARNING]
> This project is still in a very early and experimental phase. It has never
> been audited nor thoroughly reviewed for security vulnerabilities. Do not use
> in production.

Refer to our [Security Policy](../../SECURITY.md) for more details.

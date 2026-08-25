# Test fixtures

## `wormhole_core_bridge_solana_mainnet.so`

The Core Bridge program binary deployed at
`HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` on Solana mainnet-beta *before* the Pyth Pro
multisig migration. Used by `test_migrate_guardian_set.rs` to build a pre-migration bridge that the
post-migration build is then upgraded over.

Produced with:

```sh
solana program dump HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ \
    wormhole_core_bridge_solana_mainnet.so --url mainnet-beta
```

then truncated to the end of the ELF section header table, since `solana program dump` pads its
output out to the full length of the program data account.

| | |
|---|---|
| Program data account | `CmumsQAU6TvqW2VLFVySBjQYKqKDeUPMBVdrxJ2YoK1` |
| Last deploy slot | 397497639 |
| Length | 682608 bytes |
| SHA-256 | `ce1706e6ca3256f18be8c4f49bed162014eace06bea16899e82de591617f8017` |

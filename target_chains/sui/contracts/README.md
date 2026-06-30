# Build information

Contracts are built and tested with the Sui CLI, pinned to the mainnet release in `.github/workflows/ci-sui-contract.yml` (currently `mainnet-v1.72.2`). Install it with [`suiup`](https://github.com/MystenLabs/suiup), the official Sui toolchain version manager:

```commandline
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
suiup install sui@mainnet-1.72.2
suiup default set sui@mainnet-1.72.2
sui --version
```

(CI installs the same release as a prebuilt binary directly; see `.github/workflows/ci-sui-contract.yml`.)

The contracts use the Move 2024 package system (Sui package management v2): dependencies and the package's own named address are resolved via `Move.lock` environments rather than a `[addresses]` section.

## Per-network builds and deployment

Under the new package system the old per-network deploy templates (`Move.mainnet.toml`, `Move.testnet.toml`) are gone. The single `Move.toml` is built for a specific network by selecting an environment, and the on-chain published addresses live in `Published.toml`:

```bash
sui move build -e mainnet   # or: -e testnet
```

`mainnet` and `testnet` are implicit environments (no `[environments]` entry is required in `Move.toml`). For each environment, `Published.toml` records the `original-id` (the first published package address — the on-chain Pyth identity / named address) and `published-at` (the latest upgraded package address), which the build uses to link the package and its dependencies for that network. An upgrade build for a given network is therefore just `sui move build -e <network>`; no manual `Move.toml` editing is needed.

### Pro-compatible deployments

The pro-compatible variant links against the locally vendored `WormholeSimpleMajority` core bridge instead of the upstream wormhole package, so it is a distinct dependency graph rather than just another network. It is kept as a swap-in manifest (`Move.pro_compatible.toml`) with its own publication file (`Published.pro_compatible.toml`) and lock (`Move.pro_compatible.lock`). To build it, swap those into the canonical names and select the network:

```bash
cp Move.pro_compatible.toml      Move.toml
cp Move.pro_compatible.lock      Move.lock
cp Published.pro_compatible.toml Published.toml
sui move build -e mainnet        # or: -e testnet
# ...then restore the standard Move.toml / Move.lock / Published.toml
```

### Iota / Movement targets

`Move.iota_mainnet.toml`, `Move.iota_testnet.toml`, and `Move.movement_m2_devnet.toml` target the Iota and Movement chains, which use different framework dependencies (`iotaledger/iota`, a Movement Sui fork) and are built with their own CLIs — **not** the pinned Sui CLI used here and in `ci-sui-contract.yml`. They are intentionally left on their respective toolchains and are unaffected by the Sui package-system migration above.

## Gas Profiling

Using the [`sui-tool` binary](https://github.com/MystenLabs/sui/pull/12680), you can profile gas usage of transactions by running:

```bash
env MOVE_VM_PROFILE=1  ./sui-tool replay --rpc https://fullnode.mainnet.sui.io:443 tx -t <tx-signature>
```

`sui-tool` gas profiling works only when built with debug profile and should be compiled by your own (you can't use the precompiled binary).
We suggest benchmarking on mainnet or where the number of wormhole signature checks is the same as on mainnet.

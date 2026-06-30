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

## Gas Profiling

Using the [`sui-tool` binary](https://github.com/MystenLabs/sui/pull/12680), you can profile gas usage of transactions by running:

```bash
env MOVE_VM_PROFILE=1  ./sui-tool replay --rpc https://fullnode.mainnet.sui.io:443 tx -t <tx-signature>
```

`sui-tool` gas profiling works only when built with debug profile and should be compiled by your own (you can't use the precompiled binary).
We suggest benchmarking on mainnet or where the number of wormhole signature checks is the same as on mainnet.

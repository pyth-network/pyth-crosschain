# Build information

Contracts are built and tested with a prebuilt Sui CLI binary (mainnet channel), matching the version pinned in `.github/workflows/ci-sui-contract.yml`. Download the matching release from <https://github.com/MystenLabs/sui/releases> (asset `sui-mainnet-vX.Y.Z-ubuntu-x86_64.tgz`) and put `sui` on your `PATH`, e.g.:

```commandline
SUI_VERSION="v1.72.2"
curl -fsSL -o sui.tgz "https://github.com/MystenLabs/sui/releases/download/mainnet-${SUI_VERSION}/sui-mainnet-${SUI_VERSION}-ubuntu-x86_64.tgz"
tar -xzf sui.tgz
sudo mv "$(find . -maxdepth 2 -type f -name sui | head -n 1)" /usr/local/bin/sui
sui --version
```

The contracts use the Move 2024 package system (Sui package management v2): dependencies and the package's own named address are resolved via `Move.lock` environments rather than a `[addresses]` section.

## Gas Profiling

Using the [`sui-tool` binary](https://github.com/MystenLabs/sui/pull/12680), you can profile gas usage of transactions by running:

```bash
env MOVE_VM_PROFILE=1  ./sui-tool replay --rpc https://fullnode.mainnet.sui.io:443 tx -t <tx-signature>
```

`sui-tool` gas profiling works only when built with debug profile and should be compiled by your own (you can't use the precompiled binary).
We suggest benchmarking on mainnet or where the number of wormhole signature checks is the same as on mainnet.

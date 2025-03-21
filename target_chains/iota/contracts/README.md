# Build information

Contracts are compiled with sui cli version `sui 1.0.0-09b208149` that can be installed via the following command:

```commandline
cargo install --locked --git https://github.com/MystenLabs/sui.git --rev 09b2081498366df936abae26eea4b2d5cafb2788 sui sui-faucet
```

## Gas Profiling

Using the [`sui-tool` binary](https://github.com/MystenLabs/sui/pull/12680), you can profile gas usage of transactions by running:

```bash
env MOVE_VM_PROFILE=1  ./sui-tool replay --rpc https://fullnode.mainnet.sui.io:443 tx -t <tx-signature>
```

`sui-tool` gas profiling works only when built with debug profile and should be compiled by your own (you can't use the precompiled binary).
We suggest benchmarking on mainnet or where the number of wormhole signature checks is the same as on mainnet.

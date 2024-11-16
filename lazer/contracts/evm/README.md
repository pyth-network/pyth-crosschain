## Pyth Lazer EVM Contract and SDK

This package is built using [Foundry](https://book.getfoundry.sh/).

`PythLazer` is an EVM on-chain contract that keeps track of trusted signers of Pyth Lazer payloads. It allows consumers to easily check validity of Pyth Lazer signatures while enabling key rotation.

`PythLazerReceiver` contains utilities required to validate and parse Pyth Lazer payloads. Contracts should use `PythLazerReceiver` as the base contract (or one of the base contracts) of their contracts to gain access to the provided functions.

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/PythLazer.s.sol:PythLazerScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

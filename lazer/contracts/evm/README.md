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

Anvil does not come with CreateX by default. It can be deployed or an RPC which has the contract can be forked. The below command forks an RPC with a functional CreateX contract.

```shell
$ anvil --fork-url "https://eth-sepolia.public.blastapi.io"
```

### Deploy

```shell
$ forge script script/PythLazerDeploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast
```

### Upgrade

The UUPSUpgradeable feature adds functions to the cocntract which support upgrading through the use of an UUPS/ERC1967Proxy. A function can be defined to migrate state if needed. Be careful of changing storage slots when upgrading. See [Documentation](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable) for more details.
In addition, the private key is necessary or contracts will be deployed to different addresses than expected.

```shell
$ forge script script/PythLazerDeploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast --sig "migrate()"
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

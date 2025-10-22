## Pyth Lazer Sui Contract

`pyth_lazer` is a Sui package that allows consumers to easily parse and verify cryptographically signed price feed data from the Pyth Network's high-frequency Lazer protocol for use on-chain.

This package is built using the Move language edition `2024.beta` and Sui framework `v1.53.2`.

### Build, test, deploy

Install Sui CLI and build the project:

```shell
brew install sui
sui move build
```

Run tests:

```shell
sui move test
sui move test test_parse_and_verify_le_ecdsa_update # run a specific test
```

Deploy:

TODO

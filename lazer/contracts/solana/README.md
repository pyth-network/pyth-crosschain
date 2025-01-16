# Pyth Lazer Solana Receiver

## Verifiable Build

To build the program in a verifiable way, use [Solana Verify CLI](https://github.com/Ellipsis-Labs/solana-verifiable-build). This tool builds the program in
a docker container to ensure that the resulting binary is deterministic and verifiable. Run the following command to build the program
in [the lazer root directory](./../../):

```bash
solana-verify build --library-name pyth_lazer_solana_contract
```

Once the build is complete, the program binary will be located in the `target/deploy` directory.

## Setting up the Pyth Lazer Solana Receiver

Run the following command to deploy the Pyth Lazer Solana Receiver program:

```bash
solana -u <RPC_URL> program deploy target/deploy/pyth_lazer_solana_contract.so --program-id <PROGRAM_ID>
```

Once deployed, run the following Anchor script to setup the program. This script initializes the program
if it is uninitialized and updates one trusted signer of the program.

```bash
pnpm run setup --url <RPC_URL> --keypair-path <PATH/TO/KEYPAIR> --trusted-signer <Pubkey> --expiry-time-seconds <UNIX_TIMESTAMP>
```

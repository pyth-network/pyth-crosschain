# Solana receiver program for price VAA from Pythnet

The program under `cli` receives a VAA string from the shell, verifies the VAA with wormhole, posts the VAA on solana and then invokes the receiver program under `programs`.
The receiver program verifies that the VAA comes from wormhole (through the `owner` function in `state.rs`) and deserializes the price information (in `decode_posted_vaa` function of `lib.rs`).

```shell
# Generate the program key
# and use the key to replace the following two places
#     "example_sol_anchor_contract" in Anchor.toml
#     "declare_id!()" in programs/solana-receiver/src/lib.rs
> solana-keygen new -o program_address.json

# Build and deploy the receiver program
> make build
> make deploy

# Build and test the cli program
> make cli_build
> make cli_test
# Example output
...
[1/5] Decode the VAA
[2/5] Get wormhole guardian set configuration
[3/5] Invoke wormhole on solana to verify the VAA
Transaction successful : 2YQn72fQpcSBLDAkP9zt4arqx6ZKVgsbu8z7d8exT3MHJ5cLNf6JUXKFi48LhoEv6PKTUMmWBCwNe8PmYgm3pnxC
[4/5] Post the VAA data onto a solana account
Transaction successful : 32f8Cx28j7jpLFBEsj3MXbfWhrq2x1jpf382cvTD7tMKfzcAUMsw64JSvZS31fryGXKVQ7f8qMmdqTCNC8sxeY9Y
[5/5] Receive and deserialize the VAA on solana
Receiver program ID is H5gewNsx3yQbGeLZaRbzxn3CUNZz4EVSUNgs9Q1vaeWY
Transaction successful : 3YSWNemyyCXu9rza4caBRCyawUQJZviSQPfEb8Wug7HcjtQdfySuj6U3F6kWv5CJAJEqASyv9j6Z1iVpA36pyWAa
```

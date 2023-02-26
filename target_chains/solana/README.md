# Solana receiver program for price VAA from Pythnet

The program under `cli` receives a VAA string from the shell, verifies the VAA with wormhole, posts the VAA on solana and then invokes the receiver program under `programs`.
The receiver program verifies that the VAA comes from wormhole (through the `owner` function in `state.rs`) and deserializes the price information (in `decode_posted_vaa` function of `lib.rs`).

```shell
# Generate the program key
# and use the key to replace the following two places
#     "pyth_solana_receiver" in Anchor.toml
#     "declare_id!()" in programs/solana-receiver/src/lib.rs
> solana-keygen new -o program_address.json

# Build and deploy the receiver program
> anchor build
> anchor run deploy

# Build and test the cli program
> anchor run cli_build
> anchor run cli_test
# Example output
...
[1/5] Decode the VAA
[2/5] Get wormhole guardian set configuration
[3/5] Invoke wormhole on solana to verify the VAA
Transaction successful : 3VbrqQBCf1RsNLxrcvxN3aTb5fZRht4n8XDUVPM8NKniRmo84NZQUu5iFw5groAQgQYox3YCqaMjKc2WTpPU1yqV
[4/5] Post the VAA data onto a solana account
Transaction successful : 3L1vxzSHQv6B6TwtoMv2Y6m7vFGz3hzqApGHEhHSLA9Jn5dNKeWRWKv29UDPDc3vsgt1mYueamUPPt6bHGGEkbxh
[5/5] Receive and deserialize the VAA on solana
Receiver program ID is 5dXnHcDXdXaiEp9QgknCDPsEhJStSqZqJ4ATirWfEqeY
Transaction successful : u5y9Hqc18so3BnjSUvZkLZR4mvA8zkiBgzGKHSEYyWkHQhH3uQatM7xWf4kdrhjZFVGbfBLdR8RJJUmuf28ePtG
```

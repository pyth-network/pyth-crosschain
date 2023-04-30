## Testing

- run `anchor test` if no special customization for the test-validator is needed
- `anchor test` will run `solana-test-validator` will all features activated.
  One of the features activated on the test-validator which is not currently activated on pythnet is

```
"GDH5TVdbTPUpRnXaRyQqiKUa7uZAbZ28Q2N9bhbKoMLm  loosen cpi size restrictions #26641"
```

In order to run `solana-test-validator` with this feature deactivated, do the following:

1. open a terminal and run `solana-test-validator --reset --deactivate-feature GDH5TVdbTPUpRnXaRyQqiKUa7uZAbZ28Q2N9bhbKoMLm`
2. open a separate terminal and run `anchor build` in the `accumulator_updater` dir
3. get the pubkeys of the program keypairs `solana address -k accumulator_updater/target/deploy/<program_keypair>.json`
4. change the pubkeys in the `declare_id!` macro to these keypairs
5. update `Anchor.toml` `[programs.localnet]` programIds as well
6. run `anchor test --skip-local-validator`

## Questions

1.  Do we need to support multiple Whitelists?
2.  Support multiple accumulators
    1.  should each accumulator store a different type of data?
        => implications for length of merkle proof
3.  how to know what went into the `AccumulatorAccount` (for deserializing/proofs)
    1.  Header?

## To Do

1. map out flow for add/remove price & product (handled by xc_admin).
2. map out flow for update price (pyth-agent)
3. map out proposed flow for accumulator updater
4. map out current e2e flow including client/target chain
5. Need a way to map a combination of (PythAccountTypes, PythSchema) to the actual fields being used
   1. e.g. (Price, Compact) => [price, expo, timestamp]
6. Also need to be careful to preserve backwards compatibility
   by only ever appending fields if the fields for a (PythAccountType, PythSchema) combination
   ever change.
   1. maybe safer to always lock the fields once they've been published and just add new schemas (e.g. a CompactV2)

## Implementation Notes/Questions:

1. use anchor? solitaire? vanilla solana?
   1. for anchor, if add/delete/updateAccount should support multiple accounts at once, use Option or old `&ctx.accounts.remaining_accounts` call?
2. should AccumulatorMapping have its own consts

## Accumulator Update Flow:

### Add Price Account

1.  pyth-agent
2.  `pyth-contract` - add_price() ix with price account & accumulator-updater program
3.  cpi call to accumulator_updater `add_account` ix

### Update Price Account

1. pyth-agent - update_price
2. pyth-contract - update*price ix - always tries to aggregate `if clock.slot > latest_agg_price.pub_slot*`
3. if pyth-contract::aggregate_price

### Add Price "Compact" Account

## Accumulator Schema (possibly pyth-schema instead)

We could have multiple derivations of the PriceAccount that need to be included in the accumulator
ex: `PriceAccount` (full) `PriceOnly` `PriceAndEma`

### Problems

1. all calls to add/delete/update\_<pyth_account> need to include these (from the pyth-agent)
   There are 2 options for how to handle/implement this:

   1. manually update pyth-agent/contract. we would need to run our own pyth-agent calling `update_<pyth_account>`
      and always running the latest version (to account for the time gap until all publishers are running
      the latest version of pyth-agent - how realistic is this expectation?)
   2. generate a PDA that will act as a schema. then the pyth-agent could use this programmatically determine which
      accumulator accounts need to be passed in to

      ```rust
      #[repr(u8)]
      enum PythSchema {
      	full = 0,
      	compact = 1,
      	minimal = 2,
      }
      /*
      Map: {
          [accountType, [(accountSchema, FromFn), ...]
      }
      Map: {
          (accountType, accountSchema) => accountSchema::from(accountType) = F
      }
       */
      struct SchemaRegistry {
      	/// e.g.
      	/// Map {
      	///     [PriceAccount,  [0,1,2]],
      	///     [MappingAccount, [0]],
      	///     [Product, [0,1]]
      	/// }
      	schema: Map<PythAccountType, Vec<PythSchema>>
      }
      ```

      pyth-agent

      ```rust
      async fn calculate_price_accounts(price_id: Pubkey) -> Result<Vec<Pubkey>> {
      	// this will most likely be a PDA as well.
      	let schema_pubkey = Pubkey::from_str("<mapping_account>").unwrap();
      	let account = *load_schema_account(
      		rpc_client
      		.get_account_data(&schema_pubkey)
      		.await?
      	)?;
      	let schemas = account.schema.get(PythAccountType::PriceAccount)?;
      	schemas
      		.iter()
      		.map(|s| Pubkey::find_program_address(
      				[b"accumulator".as_ref(), PythAccountType::PriceAccount, s.to_le_bytes()]
      			), &acc_mapping_pid
      		).collect::<Vec<Pubkey>>()
      }

      ```

2. how to provide these transformations/schemas for clients who get the `AccumulatorInput`?
   1. Manually update them in the SDKs and as long as backwards compatibility is handled it should be okay if clients
      aren't on the latest version?

## Additional feedback/notes

Accumulator root VAA

wormhole signatures
header to distinguish this message type from the old message format -- must be in the exact same byte position as the existing batch price attestation header
merkle tree root hash
chain timestamp when it was sent -- this is "attestationTimestamp" now
slot
Merkle Tree -- just some hashes + an account key (accumulator updater PDA) for each leaf
-- accumulator PDA is derived from the (program, program controlled account pubkey -- "price feed id", serialization format -- just differentiates between different ways to save the "same" data).

Payload
-- header has (account id, schema)
-- binary data entirely controlled by the program writing the data into the accumulator

how do we look up a price update for a specific feed?
You pass the price feed id + serialization format to the price service. The price service derives the accumulator PDA for the feed (it knows the oracle program address so it can do this). The price service looks at the current wormhole-attested merkle tree root and gets the slot. It then looks at the circular buffer of merkle trees in the validator to get the proof for the PDA.

how do we update the target chain contracts in a backward-compatible way?
you look at the header for the wormhole VAA

how does the target chain code know that it has the price data for a specific price feed?

look at the account id in the header of the data payload
how do we ensure that a price update is timely?

this is the caller of the accumulator update program's responsibility to put a timestamp in the payload.

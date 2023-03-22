## Questions

1.  Do we need to support multiple Whitelists?
2.  Support multiple accumulators
    1.  should each accumulator store a different type of data?
        => implications for length of merkle proof
    2.
3.  authority?
4.  how to know what went into the `AccumulatorAccount` (for deserializing/proofs)
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

## Implemenation Notes/Questions:

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

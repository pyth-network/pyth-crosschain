// Utilities for implementing state "home" validators, tracking validated state
// as a UTxO datum in a specific "home" spending script together with state NFT,
// and only allowing priviledged updates using matching owner NFT. Inspired by:
// https://plutonomicon.github.io/plutonomicon/cngproof
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/option
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use env

pub type StateId =
  PolicyId

pub fn find(self: StateId, inputs: List<Input>) -> Data {
  expect Some(state) =
    list.find_map(
      inputs,
      fn(input) {
        let credential = input.output.address.payment_credential
        if credential == Script(self) {
          expect assets.has_nft_strict(input.output.value, self, env.state_nft)?
          expect InlineDatum(state) = input.output.datum
          Some(state)
        } else {
          None
        }
      },
    )
  state
}

pub type State<a> {
  home: ScriptHash,
  data: a,
}

pub fn new(home: ScriptHash, data: Data) -> State<Data> {
  State { home, data }
}

/// `mint` callback handler, to be used in backpassing style:
/// ```
/// validator my_state(origin: OutputReference) {
///   mint(_: Data, id: PolicyId, self: Transaction) {
///     let state <- state.mint(origin, id, self)
///     // ...check initial `state`...
///   }
/// }
/// ```
pub fn mint(
  origin: OutputReference,
  id: PolicyId,
  self: Transaction,
  with_initial: fn(State<Data>) -> Bool,
) -> Bool {
  when assets.quantity_of(self.mint, id, env.state_nft) is {
    1 -> mint_state(origin, id, self, with_initial)
    -1 -> burn_state(id, self)
    _ -> fail @"invalid home state NFT quantity"
  }
}

fn mint_state(
  origin: OutputReference,
  id: PolicyId,
  self: Transaction,
  with_initial: fn(State<Data>) -> Bool,
) {
  // state and owner NFTs should be minted in lockstep
  expect (assets.quantity_of(self.mint, id, env.owner_nft) == 1)?
  // inputs should contain origin to enforce uniqueness
  expect (transaction.find_input(self.inputs, origin) |> option.is_some())?

  // output with the NFT should contain nothing more than ADA
  expect Some(output) =
    list.find(
      self.outputs,
      fn(o) { assets.has_nft_strict(o.value, id, env.state_nft) },
    )
  // output is locked to a script to enforce valid datum updates
  expect Script(home) = output.address.payment_credential
  // output should initialize the state
  expect InlineDatum(data) = output.datum
  with_initial(State { home, data })
}

fn burn_state(id: PolicyId, self: Transaction) {
  // state and owner NFTs should be burned in lockstep
  (assets.quantity_of(self.mint, id, env.owner_nft) == -1)?
}

/// `spend` callback handler, to be used in backpassing style:
/// ```
/// spend(
///   old: Option<MyDatum>,
///   redeemer: MyRedeemer,
///   utxo: OutputReference,
///   self: Transaction,
/// ) {
///   let state, is_owner <- state.spend(old, utxo, self)
///   // `is_owner` is `True` if transaction contains owner NFT
///   // ...compute expected `home` address and new `datum`...
///   state.new(home, datum)
/// }
/// ```
pub fn spend(
  data: Option<a>,
  utxo: OutputReference,
  self: Transaction,
  with_old: fn(State<a>, Bool) -> State<Data>,
) {
  expect Some(data) = data
  let input = transaction.resolve_input(self.inputs, utxo)
  expect Script(home) = input.address.payment_credential

  // The output contains state NFT and nothing else, except ADA. We can't
  // check policy ID (minting script hash) here without introducing circular
  // dependency, so malicious entity could send here a token from a different
  // policy, but as long as we only trust state tied to a well known policy
  // ID, this spending script will always ensure that updates to it are valid.
  expect [(id, asset, 1)] =
    assets.without_lovelace(input.value) |> assets.flatten()
  expect asset == env.state_nft

  when
    list.find(
      self.outputs,
      fn(o) { assets.quantity_of(o.value, id, env.state_nft) != 0 },
    )
  is {
    // state was burned, it's up to mint to ensure validity
    None -> True
    // state is preserved, it should be updated correctly
    Some(Output { address, value, datum, .. }) -> {
      // output with the state NFT should contain nothing more than ADA
      expect assets.has_nft_strict(value, id, env.state_nft)
      // output is locked to a script to enforce valid datum updates
      expect Script(new_home) = address.payment_credential
      // output should correctly update the state
      expect InlineDatum(new_data) = datum

      let is_owner =
        list.any(
          self.inputs,
          fn(i) { assets.has_nft(i.output.value, id, env.owner_nft) },
        )
      let updated = with_old(State { home, data }, is_owner)
      (new_home == updated.home)? && (new_data == updated.data)?
    }
  }
}

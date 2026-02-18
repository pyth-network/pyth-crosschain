// Utilities for implementing state "home" validators, tracking validated state
// as a UTxO datum in a specific "home" spending script together with state NFT,
// and only allowing updates using matching owner NFT. Inspired by:
// https://plutonomicon.github.io/plutonomicon/cngproof
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/option
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}

const state_nft: ByteArray = "state"

const owner_nft: ByteArray = "owner"

pub type StateId =
  PolicyId

pub fn find_state(self: StateId, inputs: List<Input>) -> Data {
  expect Some(state) =
    list.find_map(
      inputs,
      fn(input) {
        let credential = input.output.address.payment_credential
        if credential == Script(self) {
          expect assets.has_nft_strict(input.output.value, self, state_nft)?
          expect InlineDatum(state) = input.output.datum
          Some(state)
        } else {
          None
        }
      },
    )
  state
}

pub fn mint(
  origin: OutputReference,
  home: ScriptHash,
  id: PolicyId,
  self: Transaction,
  with: fn(Data) -> Bool,
) -> Bool {
  when assets.quantity_of(self.mint, id, state_nft) is {
    1 -> mint_state(origin, home, id, self, with)
    -1 -> burn_state(id, self)
    _ -> fail @"invalid home state NFT quantity"
  }
}

fn mint_state(
  origin: OutputReference,
  home: ScriptHash,
  id: PolicyId,
  self: Transaction,
  with: fn(Data) -> Bool,
) {
  // state and owner NFTs should be minted in lockstep
  expect (assets.quantity_of(self.mint, id, owner_nft) == 1)?
  // inputs should contain origin to enforce uniqueness
  expect (transaction.find_input(self.inputs, origin) |> option.is_some())?

  // output with the NFT should contain nothing more than a companion ADA
  expect Some(output) =
    list.find(
      self.outputs,
      fn(o) { assets.has_nft_strict(o.value, id, state_nft) },
    )
  // output is locked to home script to enforce valid datum updates
  expect Script(address) = output.address.payment_credential
  expect (address == home)?
  // output should initialize the state
  expect InlineDatum(data) = output.datum
  with(data)
}

fn burn_state(id: PolicyId, self: Transaction) {
  // state and owner NFTs should be burned in lockstep
  assets.quantity_of(self.mint, id, owner_nft) == -1
}

pub fn spend(
  old: Option<a>,
  utxo: OutputReference,
  self: Transaction,
  with: fn(a, Data) -> Bool,
) {
  expect Some(old) = old
  let input = transaction.resolve_input(self.inputs, utxo)
  expect Script(home) = input.address.payment_credential

  // The output contain state NFT and nothing else, except ADA. We can't
  // check policy ID (minting script hash) here without introducing circular
  // dependency, so malicious entity could send here a token from different
  // policy, but as long as we only trust state tied to a well known policy
  // ID, this spending script will always ensure that updates to it are valid.
  expect [(id, asset, 1)] =
    assets.without_lovelace(input.value) |> assets.flatten()
  expect asset == state_nft

  // caller should provide owner NFT as a proof
  expect
    list.any(
      self.inputs,
      fn(i) { assets.has_nft_strict(i.output.value, id, owner_nft) },
    )

  when
    list.find(
      self.outputs,
      fn(o) { assets.quantity_of(o.value, id, state_nft) != 0 },
    )
  is {
    // state was burned, it's up to mint to ensure validity
    None -> True
    // state is preserved, it should be updated correctly
    Some(Output { address, value, datum, .. }) -> {
      // output with the NFT should contain nothing more than a companion ADA
      expect assets.has_nft_strict(value, id, state_nft)
      // output is locked to home script to enforce valid datum updates
      expect Script(address) = address.payment_credential
      expect address == home
      // output should correctly update the state
      expect InlineDatum(new) = datum
      with(old, new)
    }
  }
}

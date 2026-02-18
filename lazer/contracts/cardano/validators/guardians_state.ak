use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/option
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction}
use secp256k1
use wormhole.{Guardians}
use wormhole/governance
use wormhole/vaa.{VAA}

const state_nft: ByteArray = "state"

const owner_nft: ByteArray = "owner"

const genesis: Guardians =
  Guardians {
    set_index: 0,
    // Certus One:
    // https://github.com/wormhole-foundation/wormhole/blob/fe93c28401ea42bc4e62450ddaf5083110802e78/guardianset/mainnetv2/v1.prototxt#L7
    set: [#"58cc3ae5c097b213ce3c81979e1b9f9570746aa5"],
  }

validator init(origin: OutputReference, home: ScriptHash) {
  mint(_: Never, id: PolicyId, self: Transaction) {
    when assets.quantity_of(self.mint, id, state_nft) is {
      1 -> mint_guardian_set(origin, home, id, self)
      -1 -> burn_guardian_set(id, self)
      _ -> fail @"invalid guardians state NFT quantity"
    }
  }

  else(_) {
    fail
  }
}

fn mint_guardian_set(
  origin: OutputReference,
  home: ScriptHash,
  id: PolicyId,
  self: Transaction,
) {
  // state and owner NFTs should be minted in lockstep
  expect assets.quantity_of(self.mint, id, owner_nft) == 1
  // inputs should contain origin to enforce uniqueness
  expect transaction.find_input(self.inputs, origin) |> option.is_some()

  // output with the NFT should contain nothing more than a companion ADA
  expect Some(output) =
    list.find(
      self.outputs,
      fn(o) { assets.has_nft_strict(o.value, id, state_nft) },
    )
  // output is locked to home script to enforce valid datum updates
  expect Script(address) = output.address.payment_credential
  expect address == home
  // output should initialize the state using the initial guardian set
  expect InlineDatum(guardians) = output.datum
  expect guardians: Guardians = guardians
  guardians == genesis
}

fn burn_guardian_set(id: PolicyId, self: Transaction) {
  // state and owner NFTs should be burned in lockstep
  assets.quantity_of(self.mint, id, owner_nft) == -1
}

/// Upgrade VAA with needed preprocessing done off-chain
pub type PreparedUpgrade {
  vaa: ByteArray,
  recovered_keys: List<ByteArray>,
}

validator update {
  spend(
    old: Option<Guardians>,
    upgrade: PreparedUpgrade,
    utxo: OutputReference,
    self: Transaction,
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
        // output should correctly update the state based on governance VAA
        expect InlineDatum(new) = datum
        expect new: Guardians = new
        is_valid_guardians_upgrade(old, new, upgrade)
      }
    }
  }

  else(_) {
    fail
  }
}

fn is_valid_guardians_upgrade(
  old: Guardians,
  new: Guardians,
  upgrade: PreparedUpgrade,
) {
  let keys = list.map(upgrade.recovered_keys, secp256k1.public_key)
  let VAA { body, .. } = vaa.parse_and_verify(upgrade.vaa, old, keys)
  let parsed = governance.parse_guardian_set_upgrade(body.payload)
  and {
    (body.emitter_chain == governance.emitter_chain)?,
    (body.emitter_address == governance.emitter_address)?,
    (parsed == new)?,
  }
}

use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use cardano/address.{Credential}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use pyth/update.{Governance, TrustedSigner, TrustedSigners}

type PriceRedeemer {
  signed_prices: List<ByteArray>,
}

validator pyth_price(signer_policy_id: PolicyId, signer_asset: AssetName) {
  withdraw(redeemer: Data, _credential: Credential, tx: Transaction) {
    expect price_redeemer: PriceRedeemer = redeemer
    expect Some(reference_input) =
      tx.reference_inputs
        |> list.find(
            fn(in) {
              assets.has_nft(in.output.value, signer_policy_id, signer_asset)
            },
          )
    expect InlineDatum(signers_datum) = reference_input.output.datum
    expect signing_policy: TrustedSigners = signers_datum
    list.for_each(
      price_redeemer.signed_prices,
      fn(p) {
        expect _ = update.parse_and_verify(signing_policy, tx.validity_range, p)
      },
    )
    True
  }

  else(_) {
    fail
  }
}

// ── Tests ──

const signer_token_name = "signer"

fn test_tx(reference_inputs: List<Input>) -> Transaction {
  Transaction {
    inputs: [],
    reference_inputs,
    outputs: [],
    fee: 0,
    mint: assets.zero,
    certificates: [],
    withdrawals: [],
    validity_range: interval.between(0, 1000),
    extra_signatories: [],
    redeemers: [],
    datums: dict.from_pairs([]),
    id: #"cccc",
    votes: [],
    proposal_procedures: [],
    current_treasury_amount: None,
    treasury_donation: None,
  }
}

const test_signed_price =
  #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

const test_signer_pubkey =
  #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214"

fn signer_ref_input(policy_id: ByteArray, value, trusted_signers) -> Input {
  let test_governance =
    Governance {
      guardians: #"",
      emitter_chain: 1,
      emitter_address: #"",
      seen_sequence: 0,
    }
  Input {
    output_reference: OutputReference {
      transaction_id: #"bbbb",
      output_index: 0,
    },
    output: Output {
      address: address.from_script(policy_id),
      value,
      datum: InlineDatum(
        TrustedSigners { governance: test_governance, set: trusted_signers },
      ),
      reference_script: None,
    },
  }
}

test validate_single_price() {
  let signer_policy_id = #"aaaa"
  let redeemer = PriceRedeemer { signed_prices: [test_signed_price] }
  let ref_input =
    signer_ref_input(
      signer_policy_id,
      assets.from_asset(signer_policy_id, signer_token_name, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 1000 }],
    )
  let my_credential = address.Script(#"dddd")
  let tx = test_tx([ref_input])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

test validate_outdated_signer() fail {
  let signer_policy_id = #"aaaa"
  let redeemer = PriceRedeemer { signed_prices: [test_signed_price] }
  let ref_input =
    signer_ref_input(
      signer_policy_id,
      assets.from_asset(signer_policy_id, signer_token_name, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 500 }],
    )
  let my_credential = address.Script(#"dddd")
  let tx = test_tx([ref_input])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

test validate_multiple_prices() {
  let signer_policy_id = #"aaaa"
  let redeemer =
    PriceRedeemer { signed_prices: [test_signed_price, test_signed_price] }
  let ref_input =
    signer_ref_input(
      signer_policy_id,
      assets.from_asset(signer_policy_id, signer_token_name, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 10000 }],
    )
  let my_credential = address.Script(#"dddd")
  let tx = test_tx([ref_input])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

test validate_wrong_signer() fail {
  let signer_policy_id = #"aaaa"
  let redeemer = PriceRedeemer { signed_prices: [test_signed_price] }
  let ref_input =
    signer_ref_input(
      signer_policy_id,
      assets.from_asset(signer_policy_id, signer_token_name, 1),
      [
        TrustedSigner {
          key: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          expires_at: 10000,
        },
      ],
    )
  let my_credential = address.Script(#"dddd")
  let tx = test_tx([ref_input])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

test validate_no_signer_set() fail {
  let signer_policy_id = #"aaaa"
  let redeemer = PriceRedeemer { signed_prices: [test_signed_price] }
  let my_credential = address.Script(#"dddd")
  // No reference inputs at all
  let tx = test_tx([])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

test validate_missing_nft() fail {
  let signer_policy_id = #"aaaa"
  let redeemer = PriceRedeemer { signed_prices: [test_signed_price] }
  // Reference input has correct datum but no signer NFT in its value
  let ref_input =
    signer_ref_input(
      signer_policy_id,
      assets.zero,
      [TrustedSigner { key: test_signer_pubkey, expires_at: 10000 }],
    )
  let my_credential = address.Script(#"dddd")
  let tx = test_tx([ref_input])

  pyth_price.withdraw(
    signer_policy_id,
    signer_token_name,
    redeemer,
    my_credential,
    tx,
  )
}

use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use cardano/address.{Credential, Script}
use cardano/assets
use cardano/transaction.{InlineDatum, Input, Output, OutputReference, Transaction}
use validate.{PythSigningPolicy, validate_raw_price_message}

type PriceRedeemer {
  signed_prices: List<ByteArray>,
}

const signer_token_name = "signer"

validator pyth_price(signer_policy_id: ByteArray) {
  withdraw(redeemer: Data, _credential: Credential, tx: Transaction) {
    expect price_redeemer: PriceRedeemer = redeemer
    expect Some(reference_input) =
      tx.reference_inputs
        |> list.find(
            fn(in) {
              assets.has_nft(
                in.output.value,
                signer_policy_id,
                signer_token_name,
              )
            },
          )
    expect InlineDatum(signers_datum) = reference_input.output.datum
    expect signing_policy: PythSigningPolicy = signers_datum
    price_redeemer.signed_prices
      |> list.all(
          validate_raw_price_message(_, signing_policy, tx.validity_range),
        )
  }

  else(_) {
    fail
  }
}

// ── Tests ──

test validate_single_price() {
  let signer_policy_id = #"aaaa"
  let signed_price =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  let redeemer = PriceRedeemer { signed_prices: [signed_price] }
  let pyth_signing_policy =
    Input {
      output_reference: OutputReference {
        transaction_id: #"bbbb",
        output_index: 0,
      },
      output: Output {
        address: address.from_script(signer_policy_id),
        value: assets.from_asset(signer_policy_id, signer_token_name, 1),
        datum: InlineDatum(
          PythSigningPolicy {
            trusted_signers: [
              (
                #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214",
                interval.everything,
              ),
            ],
          },
        ),
        reference_script: None,
      },
    }
  let my_credential = address.Script(#"dddd")
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [pyth_signing_policy],
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

  pyth_price.withdraw(signer_policy_id, redeemer, my_credential, tx)
}

test validate_outdated_signer() fail {
  let signer_policy_id = #"aaaa"
  let signed_price =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  let redeemer = PriceRedeemer { signed_prices: [signed_price] }
  let pyth_signing_policy =
    Input {
      output_reference: OutputReference {
        transaction_id: #"bbbb",
        output_index: 0,
      },
      output: Output {
        address: address.from_script(signer_policy_id),
        value: assets.from_asset(signer_policy_id, signer_token_name, 1),
        datum: InlineDatum(
          PythSigningPolicy {
            trusted_signers: [
              (
                #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214",
                interval.between(0, 500),
              ),
            ],
          },
        ),
        reference_script: None,
      },
    }
  let my_credential = address.Script(#"dddd")
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [pyth_signing_policy],
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

  pyth_price.withdraw(signer_policy_id, redeemer, my_credential, tx)
}

test validate_multiple_prices() {
  let signer_policy_id = #"aaaa"
  let signed_price =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  let redeemer =
    PriceRedeemer { signed_prices: [signed_price, signed_price] }
  let pyth_signing_policy =
    Input {
      output_reference: OutputReference {
        transaction_id: #"bbbb",
        output_index: 0,
      },
      output: Output {
        address: address.from_script(signer_policy_id),
        value: assets.from_asset(signer_policy_id, signer_token_name, 1),
        datum: InlineDatum(
          PythSigningPolicy {
            trusted_signers: [
              (
                #"74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214",
                interval.everything,
              ),
            ],
          },
        ),
        reference_script: None,
      },
    }
  let my_credential = address.Script(#"dddd")
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [pyth_signing_policy],
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

  pyth_price.withdraw(signer_policy_id, redeemer, my_credential, tx)
}

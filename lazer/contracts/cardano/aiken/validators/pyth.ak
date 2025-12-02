use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKey, VerificationKeyHash}
use aiken/interval.{Interval}
use cardano/address.{Credential, Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use validate.{PythSigningPolicy, validate_raw_price_message}

type PriceRedeemer {
  //name of the NFT asset that marks the set of trusted signers
  pyth_policy_id: ByteArray,
  signed_prices: List<ByteArray>,
}

type MintAction {
  //minting new signing policy
  AddPythTrustedSigner
  //burning old signing policy
  RemovePythTrustedSigner
}

const signer_token_name = "signer"

validator pyth(owner: VerificationKeyHash) {
  mint(redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    expect action: MintAction = redeemer
    // only the owner can mint/burn tokens
    let signed_by_owner = tx.extra_signatories |> list.has(owner)

    // there must be exactly one asset being minted/burned
    expect [Pair(asset_name, quantity)] =
      tx.mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs()

    //check that all the outputs that contain the signer token are owned by me
    let _ =
      tx.outputs
        |> list.all(
            fn(out) {
              let has_asset =
                assets.quantity_of(out.value, policy_id, signer_token_name) > 0
            },
          )

    when action is {
      AddPythTrustedSigner ->
        // the asset name must be the transaction ID to ensure uniqueness
        and {
          signed_by_owner,
          asset_name == signer_token_name,
          quantity == 1,
        }
      RemovePythTrustedSigner -> {
        expect [Pair(_, -1)] =
          tx.mint
            |> assets.tokens(policy_id)
            |> dict.to_pairs()
        and {
          signed_by_owner,
          quantity == -1,
        }
      }
    }
  }

  withdraw(redeemer: Data, credential: Credential, tx: Transaction) {
    expect Script(my_hash) = credential
    //The redeemer includes the pyth policy ID and the list of prices to validate
    expect price_redeemer: PriceRedeemer = redeemer
    expect Some(reference_input) =
      tx.reference_inputs
        |> list.find(
            fn(in) {
              assets.has_nft(
                in.output.value,
                my_hash,
                price_redeemer.pyth_policy_id,
              )
            },
          )
    expect InlineDatum(signers_datum) = reference_input.output.datum
    expect signing_policy: PythSigningPolicy = signers_datum
    price_redeemer.signed_prices
      |> list.all(
          validate_raw_price_message(_, signing_policy, tx.validity_range),
        )
    //TODO: can we confirm we got paid?
  }

  else(_) {
    fail
  }
}

test validate_single_price() {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let pyth_policy_id = "TestSigner"
  let signed_price =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  let redeemer = PriceRedeemer { pyth_policy_id, signed_prices: [signed_price] }
  let pyth_signing_policy =
    Input {
      output_reference: OutputReference {
        transaction_id: #"bbbb",
        output_index: 0,
      },
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, pyth_policy_id, 1),
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

  pyth.withdraw(owner, redeemer, address.Script(policy_id), tx)
}

test validate_outdated_signer() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let pyth_policy_id = "TestSigner"
  let signed_price =
    #"b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000"

  let redeemer = PriceRedeemer { pyth_policy_id, signed_prices: [signed_price] }
  let pyth_signing_policy =
    Input {
      output_reference: OutputReference {
        transaction_id: #"bbbb",
        output_index: 0,
      },
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, pyth_policy_id, 1),
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

  pyth.withdraw(owner, redeemer, address.Script(policy_id), tx)
}

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction}
use validate.{PythSigningPolicy}

const signer_token_name = "signer"

validator signer_nft(owner: VerificationKeyHash) {
  mint(_redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    let signed_by_owner = tx.extra_signatories |> list.has(owner)

    expect [Pair(asset_name, quantity)] =
      tx.mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs()

    if quantity == 1 {
      // Minting: check asset name and that tokens go to script address
      let signer_tokens_owned_by_script =
        tx.outputs
          |> list.all(
              fn(out) {
                let has_asset =
                  assets.has_nft(out.value, policy_id, signer_token_name)
                if has_asset {
                  out.address.payment_credential == Script(policy_id)
                } else {
                  True
                }
              },
            )

      and {
        signed_by_owner,
        asset_name == signer_token_name,
        signer_tokens_owned_by_script,
      }
    } else if quantity == -1 {
      // Burning: The case where we want to tear down and destroy the NFT forever
      signed_by_owner
    } else {
      fail
    }
  }

  spend(
    _datum: Option<Data>,
    _redeemer: Data,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    let signed_by_owner = tx.extra_signatories |> list.has(owner)

    expect Some(own_input) =
      tx.inputs |> list.find(fn(i) { i.output_reference == own_ref })
    expect Script(own_hash) = own_input.output.address.payment_credential

    let outputs_valid =
      tx.outputs
        |> list.all(
            fn(out: Output) {
              let has_asset =
                assets.has_nft(out.value, own_hash, signer_token_name)
              if has_asset {
                and {
                  out.address.payment_credential == Script(own_hash),
                  datum_is_valid_signing_policy(out),
                }
              } else {
                True
              }
            },
          )

    and {
      signed_by_owner,
      outputs_valid,
    }
  }

  else(_) {
    fail
  }
}

fn datum_is_valid_signing_policy(out: Output) -> Bool {
  when out.datum is {
    InlineDatum(d) -> {
      expect _policy: PythSigningPolicy = d
      True
    }
    _ -> False
  }
}

// ── Tests ──

test mint_add_signer() {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(policy_id),
          value: assets.from_asset(policy_id, signer_token_name, 1),
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
      ],
      fee: 0,
      mint: assets.from_asset(policy_id, signer_token_name, 1),
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.mint(owner, Void, policy_id, tx)
}

test mint_add_signer_wrong_owner() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let wrong_signer =
    #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  let policy_id = #"aaaa"
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(policy_id),
          value: assets.from_asset(policy_id, signer_token_name, 1),
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
      ],
      fee: 0,
      mint: assets.from_asset(policy_id, signer_token_name, 1),
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [wrong_signer],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.mint(owner, Void, policy_id, tx)
}

test mint_signer_sent_to_wrong_address() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let wrong_script = #"bbbb"
  let policy_id = #"aaaa"
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(wrong_script),
          value: assets.from_asset(policy_id, signer_token_name, 1),
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
      ],
      fee: 0,
      mint: assets.from_asset(policy_id, signer_token_name, 1),
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.mint(owner, Void, policy_id, tx)
}

test mint_remove_signer() {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let tx =
    Transaction {
      inputs: [],
      reference_inputs: [],
      outputs: [],
      fee: 0,
      mint: assets.from_asset(policy_id, signer_token_name, -1),
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.mint(owner, Void, policy_id, tx)
}

test spend_update_signers() {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let own_ref = OutputReference { transaction_id: #"bbbb", output_index: 0 }
  let own_input =
    transaction.Input {
      output_reference: own_ref,
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, signer_token_name, 1),
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
      inputs: [own_input],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(policy_id),
          value: assets.from_asset(policy_id, signer_token_name, 1),
          datum: InlineDatum(
            PythSigningPolicy {
              trusted_signers: [
                (
                  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  interval.everything,
                ),
              ],
            },
          ),
          reference_script: None,
        },
      ],
      fee: 0,
      mint: assets.zero,
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.spend(owner, None, Void, own_ref, tx)
}

test spend_update_signers_wrong_owner() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let wrong_signer =
    #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  let policy_id = #"aaaa"
  let own_ref = OutputReference { transaction_id: #"bbbb", output_index: 0 }
  let own_input =
    transaction.Input {
      output_reference: own_ref,
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, signer_token_name, 1),
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
      inputs: [own_input],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(policy_id),
          value: assets.from_asset(policy_id, signer_token_name, 1),
          datum: InlineDatum(
            PythSigningPolicy {
              trusted_signers: [
                (
                  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  interval.everything,
                ),
              ],
            },
          ),
          reference_script: None,
        },
      ],
      fee: 0,
      mint: assets.zero,
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [wrong_signer],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.spend(owner, None, Void, own_ref, tx)
}

test spend_update_signers_sent_elsewhere() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let wrong_script = #"bbbb"
  let own_ref = OutputReference { transaction_id: #"bbbb", output_index: 0 }
  let own_input =
    transaction.Input {
      output_reference: own_ref,
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, signer_token_name, 1),
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
      inputs: [own_input],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(wrong_script),
          value: assets.from_asset(policy_id, signer_token_name, 1),
          datum: InlineDatum(
            PythSigningPolicy {
              trusted_signers: [
                (
                  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  interval.everything,
                ),
              ],
            },
          ),
          reference_script: None,
        },
      ],
      fee: 0,
      mint: assets.zero,
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.spend(owner, None, Void, own_ref, tx)
}

test spend_update_signers_bad_datum() fail {
  let owner =
    #"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  let policy_id = #"aaaa"
  let own_ref = OutputReference { transaction_id: #"bbbb", output_index: 0 }
  let own_input =
    transaction.Input {
      output_reference: own_ref,
      output: Output {
        address: address.from_script(policy_id),
        value: assets.from_asset(policy_id, signer_token_name, 1),
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
      inputs: [own_input],
      reference_inputs: [],
      outputs: [
        Output {
          address: address.from_script(policy_id),
          value: assets.from_asset(policy_id, signer_token_name, 1),
          // Bad datum: just a bytearray, not a PythSigningPolicy
          datum: InlineDatum(#"deadbeef"),
          reference_script: None,
        },
      ],
      fee: 0,
      mint: assets.zero,
      certificates: [],
      withdrawals: [],
      validity_range: interval.everything,
      extra_signatories: [owner],
      redeemers: [],
      datums: dict.from_pairs([]),
      id: #"cccc",
      votes: [],
      proposal_procedures: [],
      current_treasury_amount: None,
      treasury_donation: None,
    }

  signer_nft.spend(owner, None, Void, own_ref, tx)
}

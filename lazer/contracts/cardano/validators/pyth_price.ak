use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use cardano/address.{Credential, Script}
use cardano/assets
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use env
use pyth/governance.{Governance}
use pyth/update.{TrustedSigner}
use pyth_state.{Pyth}
use state.{StateId}

validator pyth_price(pyth_id: StateId) {
  withdraw(updates: List<ByteArray>, credential: Credential, self: Transaction) {
    expect pyth: Pyth = state.find(pyth_id, self.reference_inputs)
    expect Script(hash) = credential
    expect
      pyth_state.is_active_withdraw_script(pyth, self.validity_range, hash)?
    expect _ =
      list.for_each(
        updates,
        fn(update) {
          expect _ =
            update.parse_and_verify(
              update,
              pyth.trusted_signers,
              self.validity_range,
            )
        },
      )
    True
  }

  else(_) {
    fail
  }
}

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
        Pyth {
          governance: test_governance,
          trusted_signers,
          deprecated_withdraw_scripts: [],
          withdraw_script: test_withdraw_script_hash,
        },
      ),
      reference_script: None,
    },
  }
}

const test_pyth_id = #"41f41f41f41f41f41f41f41f41f41f41f41f41f41f41f41f41f41f41"

const test_withdraw_script_hash =
  #"3174d2a33174d2a33174d2a33174d2a33174d2a33174d2a33174d2a3"

test validate_single_price() {
  let ref_input =
    signer_ref_input(
      test_pyth_id,
      assets.from_asset(test_pyth_id, env.state_nft, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 1000 }],
    )

  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([ref_input]),
  )
}

test validate_outdated_signer() fail {
  let ref_input =
    signer_ref_input(
      test_pyth_id,
      assets.from_asset(test_pyth_id, env.state_nft, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 500 }],
    )

  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([ref_input]),
  )
}

test validate_multiple_prices() {
  let ref_input =
    signer_ref_input(
      test_pyth_id,
      assets.from_asset(test_pyth_id, env.state_nft, 1),
      [TrustedSigner { key: test_signer_pubkey, expires_at: 10000 }],
    )

  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price, test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([ref_input]),
  )
}

test validate_wrong_signer() fail {
  let ref_input =
    signer_ref_input(
      test_pyth_id,
      assets.from_asset(test_pyth_id, env.state_nft, 1),
      [
        TrustedSigner {
          key: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          expires_at: 10000,
        },
      ],
    )

  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([ref_input]),
  )
}

test validate_no_signer_set() fail {
  // No reference inputs at all
  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([]),
  )
}

test validate_missing_nft() fail {
  // Reference input has correct datum but no signer NFT in its value
  let ref_input =
    signer_ref_input(
      test_pyth_id,
      assets.zero,
      [TrustedSigner { key: test_signer_pubkey, expires_at: 10000 }],
    )
  pyth_price.withdraw(
    test_pyth_id,
    [test_signed_price],
    Script(test_withdraw_script_hash),
    test_tx([ref_input]),
  )
}

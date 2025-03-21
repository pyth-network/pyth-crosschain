// SPDX-License-Identifier: Apache 2

/// This module implements handling a governance VAA to enact upgrading the
/// Pyth contract to a new build. The procedure to upgrade this contract
/// requires a Programmable Transaction, which includes the following procedure:
/// 1.  Load new build.
/// 2.  Authorize upgrade.
/// 3.  Upgrade.
/// 4.  Commit upgrade.
module pyth::contract_upgrade {
    use sui::event::{Self};
    use sui::object::{ID};
    use sui::package::{UpgradeReceipt, UpgradeTicket};
    use wormhole::bytes32::{Self, Bytes32};
    use wormhole::cursor::{Self};

    use pyth::state::{Self, State};
    use pyth::governance_instruction::{Self};
    use pyth::governance_action::{Self};
    use pyth::governance::{Self, WormholeVAAVerificationReceipt};

    friend pyth::migrate;

    /// Digest is all zeros.
    const E_DIGEST_ZERO_BYTES: u64 = 0;
    const E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE: u64 = 1;
    const E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO: u64 = 2;
    const E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER: u64 = 3;

    // Event reflecting package upgrade.
    struct ContractUpgraded has drop, copy {
        old_contract: ID,
        new_contract: ID
    }

    struct UpgradeContract {
        digest: Bytes32
    }

    /// Redeem governance VAA to issue an `UpgradeTicket` for the upgrade given
    /// a contract upgrade VAA. This governance message is only relevant for Sui
    /// because a contract upgrade is only relevant to one particular network
    /// (in this case Sui), whose build digest is encoded in this message.
    public fun authorize_upgrade(
        pyth_state: &mut State,
        receipt: WormholeVAAVerificationReceipt,
    ): UpgradeTicket {

        // Get the sequence number of the governance VAA that was used to
        // generate the receipt.
        let sequence = governance::take_sequence(&receipt);

        // Require that new sequence number is greater than last executed sequence number.
        assert!(sequence > state::get_last_executed_governance_sequence(pyth_state),
            E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER);

        // Update latest executed sequence number to current one.
        state::set_last_executed_governance_sequence_unchecked(pyth_state, sequence);

        let digest = take_upgrade_digest(receipt);
        // Proceed with processing new implementation version.
        handle_upgrade_contract(pyth_state, digest)
    }


    public(friend) fun take_upgrade_digest(receipt: WormholeVAAVerificationReceipt): Bytes32 {
        let payload = governance::take_payload(&receipt);

        let instruction = governance_instruction::from_byte_vec(payload);

        // Get the governance action.
        let action = governance_instruction::get_action(&instruction);

        assert!(action == governance_action::new_contract_upgrade(),
            E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE);

        assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
            E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO);

        governance::destroy(receipt);
        // upgrade_payload contains a 32-byte digest
        let upgrade_payload = governance_instruction::destroy(instruction);

        take_digest(upgrade_payload)
    }

    /// Finalize the upgrade that ran to produce the given `receipt`. This
    /// method invokes `state::commit_upgrade` which interacts with
    /// `sui::package`.
    public fun commit_upgrade(
        self: &mut State,
        receipt: UpgradeReceipt,
    ) {
        let (old_contract, new_contract) = state::commit_upgrade(self, receipt);

        // Emit an event reflecting package ID change.
        event::emit(ContractUpgraded { old_contract, new_contract });
    }

    /// Privileged method only to be used by this module and `migrate` module.
    ///
    /// During migration, we make sure that the digest equals what we expect by
    /// passing in the same VAA used to upgrade the package.
    public(friend) fun take_digest(governance_payload: vector<u8>): Bytes32 {
        // Deserialize the payload as the build digest.
        let UpgradeContract { digest } = deserialize(governance_payload);

        digest
    }

    fun handle_upgrade_contract(
        pyth_state: &mut State,
        digest: Bytes32
    ): UpgradeTicket {
        state::authorize_upgrade(pyth_state, digest)
    }

    fun deserialize(payload: vector<u8>): UpgradeContract {
        let cur = cursor::new(payload);
        let digest = bytes32::take_bytes(&mut cur);
        assert!(bytes32::is_nonzero(&digest), E_DIGEST_ZERO_BYTES);

        // there might be additional appended to payload in the future,
        // which is why we don't cursor::destroy_empty(&mut cur)
        cursor::take_rest(cur);
        UpgradeContract { digest }
    }

    #[test_only]
    /// Specific governance payload ID (action) to complete upgrading the
    /// contract.
    /// TODO: is it okay for the contract upgrade action for Pyth to be 0? Or should it be 1?
    const CONTRACT_UPGRADE: u8 = 0;


    #[test_only]
    public fun action(): u8 {
        CONTRACT_UPGRADE
    }
}

#[test_only]
module pyth::upgrade_contract_tests {
    // TODO
}

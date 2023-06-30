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
    use wormhole::governance_message::{Self, DecreeTicket, DecreeReceipt};

    use pyth::state::{Self, State};
    use pyth::governance_witness::{GovernanceWitness, new_governance_witness};
    use pyth::governance_instruction::{Self};
    use pyth::governance_action::{Self};

    friend pyth::migrate;

    /// Digest is all zeros.
    const E_DIGEST_ZERO_BYTES: u64 = 0;
    const E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE: u64 = 1;
    const E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO: u64 = 2;

    /// Specific governance payload ID (action) to complete upgrading the
    /// contract.
    /// TODO: is it okay for the contract upgrade action for Pyth to be 0? Or should it be 1?
    const CONTRACT_UPGRADE: u8 = 0;

    // Event reflecting package upgrade.
    struct ContractUpgraded has drop, copy {
        old_contract: ID,
        new_contract: ID
    }

    struct UpgradeContract {
        digest: Bytes32
    }

    public fun authorize_governance(
        pyth_state: &State
    ): DecreeTicket<GovernanceWitness> {
        governance_message::authorize_verify_local(
            new_governance_witness(),
            state::governance_chain(pyth_state),
            state::governance_contract(pyth_state),
            state::governance_module(),
            CONTRACT_UPGRADE
        )
    }

    /// Redeem governance VAA to issue an `UpgradeTicket` for the upgrade given
    /// a contract upgrade VAA. This governance message is only relevant for Sui
    /// because a contract upgrade is only relevant to one particular network
    /// (in this case Sui), whose build digest is encoded in this message.
    public fun authorize_upgrade(
        pyth_state: &mut State,
        receipt: DecreeReceipt<GovernanceWitness>
    ): UpgradeTicket {

        // Current package checking when consuming VAA hashes. This is because
        // upgrades are protected by the Sui VM, enforcing the latest package
        // is the one performing the upgrade.
        let consumed =
            state::borrow_mut_consumed_vaas_unchecked(pyth_state);

        // And consume.
        let payload = governance_message::take_payload(consumed, receipt);

        let instruction = governance_instruction::from_byte_vec(payload);

        // Get the governance action.
        let action = governance_instruction::get_action(&instruction);

        assert!(action == governance_action::new_contract_upgrade(),
             E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE);

        assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
             E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO);

        // upgrade_payload contains a 32-byte digest
        let upgrade_payload = governance_instruction::destroy(instruction);

        // Proceed with processing new implementation version.
        handle_upgrade_contract(pyth_state, upgrade_payload)
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
        payload: vector<u8>
    ): UpgradeTicket {
        state::authorize_upgrade(pyth_state, take_digest(payload))
    }

    fun deserialize(payload: vector<u8>): UpgradeContract {
        let cur = cursor::new(payload);

        // This amount cannot be greater than max u64.
        let digest = bytes32::take_bytes(&mut cur);
        assert!(bytes32::is_nonzero(&digest), E_DIGEST_ZERO_BYTES);

        cursor::destroy_empty(cur);

        UpgradeContract { digest }
    }

    #[test_only]
    public fun action(): u8 {
        CONTRACT_UPGRADE
    }
}

#[test_only]
module pyth::upgrade_contract_tests {
    // TODO
}

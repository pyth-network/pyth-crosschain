// SPDX-License-Identifier: Apache 2

/// Note: This module is based on the upgrade_contract module
/// from the Sui Wormhole package:
/// https://github.com/wormhole-foundation/wormhole/blob/sui/integration_v2/sui/wormhole/sources/governance/upgrade_contract.move

/// This module implements handling a governance VAA to enact upgrading the
/// Pyth contract to a new build. The procedure to upgrade this contract
/// requires a Programmable Transaction, which includes the following procedure:
/// 1.  Load new build.
/// 2.  Authorize upgrade.
/// 3.  Upgrade.
/// 4.  Commit upgrade.
module pyth::contract_upgrade {
    use sui::event::{Self};
    use sui::object::{Self, ID};
    use sui::package::{UpgradeReceipt, UpgradeTicket};

    use pyth::state::{Self, State};

    use wormhole::bytes32::{Self, Bytes32};
    use wormhole::cursor::{Self};

    friend pyth::governance;

    /// Digest is all zeros.
    const E_DIGEST_ZERO_BYTES: u64 = 0;
    /// Specific governance payload ID (action) to complete upgrading the
    /// contract.
    const ACTION_UPGRADE_CONTRACT: u8 = 1;

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
    ///
    /// NOTE: This method is guarded by a minimum build version check. This
    /// method could break backward compatibility on an upgrade.
    public(friend) fun execute(
        pyth_state: &mut State,
        payload: vector<u8>,
    ): UpgradeTicket {
        // Proceed with processing new implementation version.
        handle_upgrade_contract(pyth_state, payload)
    }

    fun handle_upgrade_contract(
        pyth_state: &mut State,
        payload: vector<u8>
    ): UpgradeTicket {

        let UpgradeContract { digest } = deserialize(payload);

        state::authorize_upgrade(pyth_state, digest)
    }

    /// Finalize the upgrade that ran to produce the given `receipt`. This
    /// method invokes `state::commit_upgrade` which interacts with
    /// `sui::package`.
    public fun commit_upgrade(
        self: &mut State,
        receipt: UpgradeReceipt,
    ) {
        let latest_package_id = state::commit_upgrade(self, receipt);

        // Emit an event reflecting package ID change.
        event::emit(
            ContractUpgraded {
                old_contract: object::id_from_address(@pyth),
                new_contract: latest_package_id
            }
        );
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
        ACTION_UPGRADE_CONTRACT
    }
}

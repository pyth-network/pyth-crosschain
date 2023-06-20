// SPDX-License-Identifier: Apache 2


/// Note: this module is adapted from Wormhole's migrade.move module.
///
/// This module implements a public method intended to be called after an
/// upgrade has been commited. The purpose is to add one-off migration logic
/// that would alter Pyth `State`.
///
/// Included in migration is the ability to ensure that breaking changes for
/// any of Pyth's methods by enforcing the current build version as
/// their required minimum version.
module pyth::migrate {
    use sui::object::{ID};
    use wormhole::governance_message::{Self, DecreeReceipt};

    use pyth::state::{Self, State};
    use pyth::contract_upgrade::{Self};
    use pyth::governance_witness::{GovernanceWitness};

    struct MigrateComplete has drop, copy {
        package: ID
    }

    public fun migrate(
        pyth_state: &mut State,
        receipt: DecreeReceipt<GovernanceWitness>
    ) {
        // This should be removed in an upgrade from 0.1.1.
        state::migrate__v__0_1_1(pyth_state);

        // Perform standard migrate.
        handle_migrate(pyth_state, receipt);

        ////////////////////////////////////////////////////////////////////////
        //
        // NOTE: Put any one-off migration logic here.
        //
        // Most upgrades likely won't need to do anything, in which case the
        // rest of this function's body may be empty. Make sure to delete it
        // after the migration has gone through successfully.
        //
        // WARNING: The migration does *not* proceed atomically with the
        // upgrade (as they are done in separate transactions).
        // If the nature of this migration absolutely requires the migration to
        // happen before certain other functionality is available, then guard
        // that functionality with the `assert!` from above.
        //
        ////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////
    }

    fun handle_migrate(
        pyth_state: &mut State,
        receipt: DecreeReceipt<GovernanceWitness>
    ) {
        // Update the version first.
        //
        // See `version_control` module for hard-coded configuration.
        state::migrate_version(pyth_state);

        // This capability ensures that the current build version is used.
        let latest_only = state::assert_latest_only(pyth_state);

        // Check if build digest is the current one.
        let digest =
            contract_upgrade::take_digest(
                governance_message::payload(&receipt)
            );
        state::assert_authorized_digest(
            &latest_only,
            pyth_state,
            digest
        );
        governance_message::destroy(receipt);

        // Finally emit an event reflecting a successful migrate.
        let package = state::current_package(&latest_only, pyth_state);
        sui::event::emit(MigrateComplete { package });
    }

    #[test_only]
    public fun set_up_migrate(pyth_state: &mut State) {
        state::reverse_migrate__v__0_1_0(pyth_state);
    }
}

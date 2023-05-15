// SPDX-License-Identifier: Apache 2

/// Note: This module is largely taken from the Sui Wormhole package:
/// https://github.com/wormhole-foundation/wormhole/blob/sui/integration_v2/sui/wormhole/sources/migrate.move

/// This module implements an entry method intended to be called after an
/// upgrade has been commited. The purpose is to add one-off migration logic
/// that would alter pyth `State`.
///
/// Included in migration is the ability to ensure that breaking changes for
/// any of pyth's methods by enforcing the current build version as their
/// required minimum version.
module pyth::migrate {
    use pyth::state::{Self, State};

    // This import is only used when `state::require_current_version` is used.
    // use pyth::version_control::{Self as control};

    /// Upgrade procedure is not complete (most likely due to an upgrade not
    /// being initialized since upgrades can only be performed via programmable
    /// transaction).
    const E_CANNOT_MIGRATE: u64 = 0;

    /// Execute migration logic. See `pyth::migrate` description for more
    /// info.
    public entry fun migrate(pyth_state: &mut State) {
        // pyth `State` only allows one to call `migrate` after the upgrade
        // procedure completed.
        assert!(state::can_migrate(pyth_state), E_CANNOT_MIGRATE);

        ////////////////////////////////////////////////////////////////////////
        //
        // If there are any methods that require the current build, we need to
        // explicity require them here.
        //
        // Calls to `require_current_version` are commented out for convenience.
        //
        ////////////////////////////////////////////////////////////////////////


        // state::require_current_version<control::SetDataSources>(pyth_state);
        // state::require_current_version<control::SetGovernanceDataSource>(pyth_state);
        // state::require_current_version<control::SetStalePriceThreshold>(pyth_state);
        // state::require_current_version<control::SetUpdateFee>(pyth_state);
        // state::require_current_version<control::TransferFee>(pyth_state);
        // state::require_current_version<control::UpdatePriceFeeds>(pyth_state);
        // state::require_current_version<control::CreatePriceFeeds>(pyth_state);

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
        // If the nature of your migration absolutely requires the migration to
        // happen before certain other functionality is available, then guard
        // that functionality with the `assert!` from above.
        //
        ////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////
        // Ensure that `migrate` cannot be called again.
        state::disable_migration(pyth_state);
    }
}

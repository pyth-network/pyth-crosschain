// SPDX-License-Identifier: Apache 2

/// Note: this module is adapted from Wormhole's version_control.move module.
///
/// This module implements dynamic field keys as empty structs. These keys are
/// used to determine the latest version for this build. If the current version
/// is not this build's, then paths through the `state` module will abort.
///
/// See `pyth::state` and `wormhole::package_utils` for more info.
module pyth::version_control;

////////////////////////////////////////////////////////////////////////////
//
//  Hard-coded Version Control
//
//  Before upgrading, please set the types for `current_version` and
//  `previous_version` to match the correct types (current being the latest
//  version reflecting this build).
//
////////////////////////////////////////////////////////////////////////////

public(package) fun current_version(): V__0_1_2 {
    V__0_1_2 {}
}

public(package) fun previous_version(): V__0_1_1 {
    V__0_1_1 {}
}

////////////////////////////////////////////////////////////////////////////
//
//  Change Log
//
//  Please write release notes as doc strings for each version struct. These
//  notes will be our attempt at tracking upgrades. Wish us luck.
//
////////////////////////////////////////////////////////////////////////////

/// RELEASE NOTES
///
/// - Gas optimizations on merkle tree verifications
public struct V__0_1_2 has copy, drop, store {}

/// RELEASE NOTES
///
/// - Refactor state to use package management via
///   `wormhole::package_utils`.
/// - Add `MigrateComplete` event in `migrate`.
///
/// Also added `migrate__v__0_1_1` in `wormhole::state`, which is
/// meant to perform a one-time `State` modification via `migrate`.
public struct V__0_1_1 has copy, drop, store {}

// Dummy.
public struct V__DUMMY has copy, drop, store {}

////////////////////////////////////////////////////////////////////////////
//
//  Implementation and Test-Only Methods
//
////////////////////////////////////////////////////////////////////////////

#[test_only]
public fun dummy(): V__DUMMY {
    V__DUMMY {}
}

#[test_only]
public struct V__MIGRATED has copy, drop, store {}

#[test_only]
public fun next_version(): V__MIGRATED {
    V__MIGRATED {}
}

#[test_only]
public fun previous_version_test_only(): V__0_1_1 {
    previous_version()
}

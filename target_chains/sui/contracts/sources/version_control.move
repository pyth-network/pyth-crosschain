// SPDX-License-Identifier: Apache 2

/// Note: This module is based on the version_control module in
/// the Sui Wormhole package:
/// https://github.com/wormhole-foundation/wormhole/blob/sui/integration_v2/sui/wormhole/sources/version_control.move

/// This module implements dynamic field keys as empty structs. These keys with
/// `RequiredVersion` are used to determine minimum build requirements for
/// particular Pyth methods and breaking backward compatibility for these
/// methods if an upgrade requires the latest upgrade version for its
/// functionality.
///
/// See `pyth::required_version` and `pyth::state` for more info.
module pyth::version_control {
    /// This value tracks the current Pyth contract version. We are
    /// placing this constant value at the top, which goes against Move style
    /// guides so that we bring special attention to changing this value when
    /// a new implementation is built for a contract upgrade.
    const CURRENT_BUILD_VERSION: u64 = 1;

    /// Key used to check minimum version requirement for `set_data_sources`
    struct SetDataSources {}

    /// Key used to check minimum version requirement for `set_governance_data_source`
    struct SetGovernanceDataSource {}

    /// Key used to check minimum version requirement for `set_stale_price_threshold`
    struct SetStalePriceThreshold {}

    /// Key used to check minimum version requirement for `set_update_fee`
    struct SetUpdateFee {}

    /// Key used to check minimum version requirement for `transfer_fee`
    struct TransferFee {}

    /// Key used to check minimum version requirement for `update_price_feeds`
    struct UpdatePriceFeeds {}

    /// Key used to check minimum version requirement for `create_price_feeds`
    struct CreatePriceFeeds {}

    //=======================================================================

    /// Return const value `CURRENT_BUILD_VERSION` for this particular build.
    /// This value is used to determine whether this implementation meets
    /// minimum requirements for various Pyth methods required by `State`.
    public fun version(): u64 {
        CURRENT_BUILD_VERSION
    }
}

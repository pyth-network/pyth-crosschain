module pyth_lazer::meta;

/// Version of this package. As Sui packages do not have access to any API that
/// would give them their current address or version, we track it manually here.
///
/// WARNING: Construction of `CurrentCap` requires this version to match the
/// `UpgradeCap` version, and thus attempts to publish or upgrade the package
/// using an invalid version will result in the package becoming locked.
public(package) fun version(): u64 {
    1
}

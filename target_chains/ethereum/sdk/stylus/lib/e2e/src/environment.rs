use std::{path::PathBuf, process::Command};

use eyre::Context;

/// Gets expected path to the nitro test node.
pub(crate) fn get_node_path() -> eyre::Result<PathBuf> {
    let manifest_dir = get_workspace_root()?;
    Ok(manifest_dir.join("nitro-testnode"))
}

/// Runs the following command to get the worskpace root:
///
/// ```bash
/// dirname "$(cargo locate-project --workspace --message-format plain)"
/// ```
pub(crate) fn get_workspace_root() -> eyre::Result<PathBuf> {
    let output = Command::new("cargo")
        .arg("locate-project")
        .arg("--workspace")
        .arg("--message-format")
        .arg("plain")
        .output()
        .wrap_err("should run `cargo locate-project`")?;

    let manifest_path = String::from_utf8_lossy(&output.stdout);
    let manifest_dir = Command::new("dirname")
        .arg(&*manifest_path)
        .output()
        .wrap_err("should run `dirname`")?;

    let path = String::from_utf8_lossy(&manifest_dir.stdout)
        .trim()
        .to_string()
        .parse::<PathBuf>()
        .wrap_err("failed to parse manifest dir path")?;
    Ok(path)
}

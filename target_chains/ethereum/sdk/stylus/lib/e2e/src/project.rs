use std::{
    env,
    ffi::OsStr,
    fs::File,
    io::{BufReader, Read},
    path::{Path, PathBuf},
};

use eyre::bail;
use toml::Table;

/// Information about the crate subject of an integration test.
pub(crate) struct Crate {
    /// Path to the directory where the crate's manifest lives.
    pub(crate) manifest_dir: PathBuf,
    /// Path to the compiled wasm binary.
    pub(crate) wasm: PathBuf,
}

impl Crate {
    /// Collects crate information from the environment.
    ///
    /// # Errors
    ///
    /// May error if:
    ///
    /// - The current working directory is invalid.
    /// - Could not read the package name from the manifest file.
    /// - Could not read the path to the compiled wasm binary.
    pub(crate) fn new() -> eyre::Result<Self> {
        let manifest_dir = env::current_dir()?;
        let name = read_pkg_name(&manifest_dir)?;
        let wasm = get_wasm(&name)?;

        Ok(Self { manifest_dir, wasm })
    }
}

/// Reads and parses the package name from a manifest in `path`.
///
/// # Errors
///
/// May error if:
///
/// - Unable to parse the `Cargo.toml` at `path`.
/// - Unable to read the package name from the parsed toml file.
fn read_pkg_name<P: AsRef<Path>>(path: P) -> eyre::Result<String> {
    let cargo_toml = path.as_ref().join("Cargo.toml");

    let mut reader = BufReader::new(File::open(cargo_toml)?);
    let mut buffer = String::new();
    reader.read_to_string(&mut buffer)?;

    let table = buffer.parse::<Table>()?;
    let name = table["package"]["name"].as_str();

    match name {
        Some(x) => Ok(x.to_owned()),
        None => Err(eyre::eyre!("unable to find package name in toml")),
    }
}

/// Returns the path to the compiled wasm binary with name `name`.
///
/// Note that this function works for both workspaces and standalone crates.
///
/// # Errors
///
/// May error if:
///
/// - Unable to read the current executable's path.
/// - The output directory is not `target`.
fn get_wasm(name: &str) -> eyre::Result<PathBuf> {
    let name = name.replace('-', "_");
    // Looks like
    // "rust-contracts-stylus/target/debug/deps/erc721-15764c2c9a33bee7".
    let mut target_dir = env::current_exe()?;

    // Recursively find a `target` directory.
    loop {
        let Some(parent) = target_dir.parent() else {
            // We've found `/`.
            bail!("output directory is not 'target'");
        };

        target_dir = parent.to_path_buf();
        let Some(leaf) = target_dir.file_name() else {
            // We've found the root because we are traversing a canonicalized
            // path, which means there are no `..` segments, and we started at
            // the executable.
            bail!("output directory is not 'target'");
        };

        if leaf == OsStr::new("target") {
            break;
        }
    }

    let wasm = target_dir
        .join("wasm32-unknown-unknown")
        .join("release")
        .join(format!("{name}.wasm"));

    Ok(wasm)
}

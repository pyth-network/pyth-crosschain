use std::io::Result;

/// Automatically runs during cargo build.
/// Proto files for Lazer are defined in the lazer sdk folder in the proto/ subdirectory.
/// Both JS and Rust SDKs read the proto files for generating types.
fn main() -> Result<()> {
    // Tell cargo to recompile if any .proto files change
    println!("cargo:rerun-if-changed=proto/");

    // Selects proto files to be read for compiling
    let proto_files = vec![
        "../../proto/pyth_lazer_transaction.proto",
        "../../proto/publisher_update.proto",
    ];

    // Compiles protos and generates Rust types
    // Generated types are present in the output folder
    prost_build::compile_protos(&proto_files, &["../../proto"])
        .expect("Failed to compile protos and generate types");

    Ok(())
}

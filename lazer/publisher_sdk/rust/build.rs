use std::io::Result;

/// Automatically runs during cargo build.
/// Proto files for Lazer are defined in the lazer sdk folder in the proto/ subdirectory.
/// Both JS and Rust SDKs read the proto files for generating types.
fn main() -> Result<()> {
    // Tell cargo to recompile if any .proto files change
    println!("cargo:rerun-if-changed=../proto/");

    protobuf_codegen::Codegen::new()
        .pure()
        .include("../proto")
        .input("../proto/publisher_update.proto")
        .input("../proto/pyth_lazer_transaction.proto")
        .cargo_out_dir("protobuf")
        .run_from_script();

    Ok(())
}

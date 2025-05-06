use std::io::Result;

use fs_err::read_dir;

/// Automatically runs during cargo build.
/// Proto files for Lazer are defined in the lazer sdk folder in the proto/ subdirectory.
/// Both JS and Rust SDKs read the proto files for generating types.
fn main() -> Result<()> {
    // Tell cargo to recompile if any .proto files change
    println!("cargo:rerun-if-changed=../proto/");

    protobuf_codegen::Codegen::new()
        .protoc()
        .protoc_extra_arg("--include_source_info")
        .include("../proto")
        .inputs(read_dir("../proto")?.map(|item| item.unwrap().path()))
        .cargo_out_dir("protobuf")
        .run_from_script();

    Ok(())
}

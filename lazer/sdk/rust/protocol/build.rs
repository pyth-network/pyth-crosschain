use std::io::Result;

fn main() -> Result<()> {
    let proto_files = vec![
        "../../proto/pyth_lazer.proto",
        "../../proto/publisher_update.proto",
    ];

    prost_build::compile_protos(&proto_files, &["../../proto"])?;

    Ok(())
}

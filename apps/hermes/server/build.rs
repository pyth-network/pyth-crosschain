use std::path::PathBuf;

/// Custom build script to compile and include the wormhole protobufs into the source.
/// The wormhole protobufs are vendored from the Wormhole git repository at https://github.com/wormhole-foundation/wormhole.git
/// They reference other protobufs from the Google API repository at https://github.com/googleapis/googleapis.git , which are also vendored.
/// Our copies live in `proto/vendor`.
fn main() {
    let proto_dir = PathBuf::from("proto/vendor");

    // Tell cargo to recompile if any .proto files change
    println!("cargo:rerun-if-changed=proto/");

    // Build the wormhole and google protobufs using Rust's prost_build crate.
    // The generated Rust code is placed in the OUT_DIR (env var set by cargo).
    // `network/wormhole.rs` then includes the generated code into the source while compilation is happening.
    #[allow(clippy::expect_used, reason = "failing at build time is fine")]
    tonic_build::configure()
        .build_server(false)
        .compile(
            &[
                proto_dir.join("spy/v1/spy.proto"),
                proto_dir.join("gossip/v1/gossip.proto"),
                proto_dir.join("node/v1/node.proto"),
                proto_dir.join("publicrpc/v1/publicrpc.proto"),
            ],
            &[proto_dir],
        )
        .expect("failed to compile protobuf definitions");
}

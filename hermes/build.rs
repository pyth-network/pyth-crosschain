use std::{
    env,
    path::PathBuf,
    process::Command,
};

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // Print OUT_DIR for debugging build issues.
    println!("OUT_DIR={}", out_dir.display());

    // We'll use git to pull in protobuf dependencies. This trick lets us use the Rust OUT_DIR
    // directory as a mini-repo with wormhole and googleapis as remotes, so we can copy out the
    // TREEISH paths we want.
    let protobuf_setup = r#"
        git init .
        git clean -df
        git remote add wormhole https://github.com/wormhole-foundation/wormhole.git
        git remote add googleapis https://github.com/googleapis/googleapis.git
        git fetch --depth=1 --porcelain wormhole main
        git fetch --depth=1 --porcelain googleapis master
        git read-tree --prefix=proto/ -u wormhole/main:proto
        git read-tree --prefix=proto/google/api/ -u googleapis/master:google/api
    "#;

    // Run each command to prepare the OUT_DIR with the protobuf definitions. We need to make sure
    // to change the working directory to OUT_DIR, otherwise git will complain.
    let _ = Command::new("sh")
        .args(["-c", protobuf_setup])
        .current_dir(&out_dir)
        .output()
        .expect("failed to setup protobuf definitions");

    // We build the resulting protobuf definitions using Rust's prost_build crate, which generates
    // Rust code from the protobuf definitions.
    tonic_build::configure()
        .build_server(false)
        .compile(
            &[
                out_dir.join("proto/spy/v1/spy.proto"),
                out_dir.join("proto/gossip/v1/gossip.proto"),
                out_dir.join("proto/node/v1/node.proto"),
                out_dir.join("proto/publicrpc/v1/publicrpc.proto"),
            ],
            &[out_dir.join("proto")],
        )
        .expect("failed to compile protobuf definitions");
}

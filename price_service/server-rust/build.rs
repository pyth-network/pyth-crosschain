use std::{
    env,
    path::PathBuf,
    process::Command,
};

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let out_var = env::var("OUT_DIR").unwrap();

    // Clone the Wormhole repository, which we need to access the protobuf definitions for Wormhole
    // P2P message types.
    //
    // TODO: This is ugly and costly, and requires git. Instead of this we should have our own tool
    // build process that can generate protobuf definitions for this and other user cases. For now
    // this is easy and works and matches upstream Wormhole's `Makefile`.
    let _ = Command::new("git")
        .args([
            "clone",
            "https://github.com/wormhole-foundation/wormhole",
            "wormhole",
        ])
        .output()
        .expect("failed to execute process");

    // Move the tools directory to the root of the repo because that's where the build script
    // expects it to be, paths get hardcoded into the binaries.
    let _ = Command::new("mv")
        .args(["wormhole/tools", "tools"])
        .output()
        .expect("failed to execute process");

    // Move the protobuf definitions to the src/network directory, we don't have to do this
    // but it is more intuitive when debugging.
    let _ = Command::new("mv")
        .args([
            "wormhole/proto/gossip/v1/gossip.proto",
            "src/network/p2p.proto",
        ])
        .output()
        .expect("failed to execute process");

    // Build the protobuf compiler.
    let _ = Command::new("./build.sh")
        .current_dir("tools")
        .output()
        .expect("failed to execute process");

    // Make the protobuf compiler executable.
    let _ = Command::new("chmod")
        .args(["+x", "tools/bin/*"])
        .output()
        .expect("failed to execute process");

    // Generate the protobuf definitions. See buf.gen.yaml to see how we rename the module for our
    // particular use case.
    let _ = Command::new("./tools/bin/buf")
        .args(["generate", "--path", "src"])
        .output()
        .expect("failed to execute process");

    // Build the Go library.
    let mut cmd = Command::new("go");
    cmd.arg("build")
        .arg("-buildmode=c-archive")
        .arg("-o")
        .arg(out_dir.join("libpythnet.a"))
        .arg("src/network/p2p.go")
        .arg("src/network/p2p.pb.go");

    // Tell Rust to link our Go library at compile time.
    println!("cargo:rustc-link-search=native={out_var}");
    println!("cargo:rustc-link-lib=static=pythnet");

    #[cfg(target_os = "aarch64")]
    println!("cargo:rustc-link-lib=resolv");

    let status = cmd.status().unwrap();
    assert!(status.success());
}

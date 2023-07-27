use std::{
    env,
    path::PathBuf,
    process::{
        Command,
        Stdio,
    },
};

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let out_var = env::var("OUT_DIR").unwrap();

    // Download the Wormhole repository at a certain tag, which we need to access the protobuf definitions
    // for Wormhole P2P message types.
    //
    // TODO: This is ugly. Instead of this we should have our own tool
    // build process that can generate protobuf definitions for this and other user cases. For now
    // this is easy and works and matches upstream Wormhole's `Makefile`.

    const WORMHOLE_VERSION: &str = "2.18.1";

    let wh_curl = Command::new("curl")
        .args([
            "-s",
            "-L",
            format!("https://github.com/wormhole-foundation/wormhole/archive/refs/tags/v{WORMHOLE_VERSION}.tar.gz").as_str(),
        ])
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to download wormhole archive");

    let _ = Command::new("tar")
        .args(["xvz"])
        .stdin(Stdio::from(wh_curl.stdout.unwrap()))
        .output()
        .expect("failed to extract wormhole archive");

    // Move the tools directory to the root of the repo because that's where the build script
    // expects it to be, paths get hardcoded into the binaries.
    let _ = Command::new("mv")
        .args([
            format!("wormhole-{WORMHOLE_VERSION}/tools").as_str(),
            "tools",
        ])
        .output()
        .expect("failed to move wormhole tools directory");

    // Move the protobuf definitions to the src/network directory, we don't have to do this
    // but it is more intuitive when debugging.
    let _ = Command::new("mv")
        .args([
            format!("wormhole-{WORMHOLE_VERSION}/proto/gossip/v1/gossip.proto").as_str(),
            "src/network/p2p.proto",
        ])
        .output()
        .expect("failed to move wormhole protobuf definitions");

    // Build the protobuf compiler.
    let _ = Command::new("./build.sh")
        .current_dir("tools")
        .output()
        .expect("failed to run protobuf compiler build script");

    // Make the protobuf compiler executable.
    let _ = Command::new("chmod")
        .args(["+x", "tools/bin/*"])
        .output()
        .expect("failed to make protofuf compiler executable");

    // Generate the protobuf definitions. See buf.gen.yaml to see how we rename the module for our
    // particular use case.
    let _ = Command::new("./tools/bin/buf")
        .args(["generate", "--path", "src"])
        .output()
        .expect("failed to generate protobuf definitions");

    let rust_target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap();

    // Build the Go library.
    let mut cmd = Command::new("go");
    cmd.arg("build")
        .arg("-buildmode=c-archive")
        .arg("-o")
        .arg(out_dir.join("libpythnet.a"))
        .arg("src/network/p2p.go")
        .arg("src/network/p2p.pb.go");

    // Cross-compile the Go binary based on the Rust target architecture
    match &*rust_target_arch {
        "x86_64" => {
            // CGO_ENABLED required for building amd64 on mac os
            cmd.env("GOARCH", "amd64").env("CGO_ENABLED", "1");
        }
        "aarch64" => {
            cmd.env("GOARCH", "arm64");
        }
        // Add other target architectures as needed
        _ => {
            panic!("Unsupported target architecture: {}", rust_target_arch);
        }
    }


    // Tell Rust to link our Go library at compile time.
    println!("cargo:rustc-link-search=native={out_var}");
    println!("cargo:rustc-link-lib=static=pythnet");
    println!("cargo:rustc-link-lib=resolv");

    let go_build_output = cmd.output().expect("Failed to execute Go build command");
    if !go_build_output.status.success() {
        let error_message = String::from_utf8_lossy(&go_build_output.stderr);
        panic!("Go build failed:\n{}", error_message);
    }
}

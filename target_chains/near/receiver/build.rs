fn main() {
    // CARGO_NEAR_ABI_GENERATION env var is set by cargo-near when generating ABI.
    // We need to expose it as a cfg option to allow conditional compilation
    // of our JsonSchema impls.
    println!("cargo::rerun-if-env-changed=CARGO_NEAR_ABI_GENERATION");
    println!("cargo::rustc-check-cfg=cfg(abi)");
    if std::env::var("CARGO_NEAR_ABI_GENERATION").as_deref() == Ok("true") {
        println!("cargo::rustc-cfg=abi");
    }
}

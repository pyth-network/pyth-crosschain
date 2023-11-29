use crate::program_test::ProgramSimulator;
use solana_program::bpf_loader_upgradeable;
use solana_program::rent::Rent;
use solana_program_test::read_file;
use solana_sdk::signature::{Keypair, Signer};
use std::path::Path;
use std::process::Stdio;

#[tokio::test]
async fn test_update_program() {
    let mut sim = ProgramSimulator::new().await;

    let buffer_keypair = Keypair::new();
    let upgrade_authority = sim.upgrade_authority;
    let program_filepath = std::env::current_dir()
        .unwrap()
        .join(Path::new("../../target/deploy/pyth_solana_receiver.so"));
    let mut program_data = read_file(
        std::env::current_dir()
            .unwrap()
            .join(Path::new("../../target/deploy/pyth_solana_receiver.so")),
    );

    let mut target_tmp_dir = std::env::current_dir()
        .unwrap()
        .join(Path::new("../../target/tmp/genesis_keypair.so"));
    println!("target_tmp_dir: {:?}", target_tmp_dir);

    let minimum_balance = Rent::default().minimum_balance(program_data.len());
    let data_len = program_data.len();
    let initial_ixs = bpf_loader_upgradeable::create_buffer(
        &sim.genesis_keypair.pubkey(),
        &buffer_keypair.pubkey(),
        &upgrade_authority.pubkey(),
        minimum_balance,
        data_len,
    )
    .unwrap();

    // let exit = std::process::Command::new("solana")
    //     .arg("program")
    //     .arg("deploy")
    //     .arg("--url")
    //     .arg("http://127.0.0.1:8899")
    //     .arg("--keypair")
    //     .arg(&ProgramSimulator::keypair_filepath("genesis_keypair"))
    //     .arg("--upgrade-authority")
    //     .arg(&ProgramSimulator::keypair_filepath("upgrade_authority"))
    //     .arg("--program-id")
    //     .arg(&sim.program_id.to_string())
    //     .arg(program_filepath)
    //     .stdout(Stdio::inherit())
    //     .stderr(Stdio::inherit())
    //     .output()
    //     .expect("Must deploy");
    // if !exit.status.success() {
    //     println!("There was a problem deploying: {exit:?}.");
    //     std::process::exit(exit.status.code().unwrap_or(1));
    // }
}

use {
    program_simulator::{
        ProgramBench,
        ProgramSimulator,
    },
    pyth_solana_receiver::{
        instruction::Initialize,
        state::config::{
            Config,
            DataSource,
        },
        ID,
    },
    solana_program::{
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
    },
    solana_sdk::{
        signature::Keypair,
        signer::Signer,
    },
    std::path::Path,
    wormhole_core_bridge_solana::ID as BRIDGE_ID,
};

const RELATIVE_PATH_TO_PYTH_RECEIVER_BINARY: &str = "../../target/deploy/pyth_solana_receiver.so";

pub async fn setup_pyth_receiver() -> ProgramSimulator {
    let mut program_bench = ProgramBench::new();
    program_bench
        .add_bpf_upgradable_program_from_path(ID, Path::new(RELATIVE_PATH_TO_PYTH_RECEIVER_BINARY));


    let mut program_simulator = program_bench.start().await;

    let governance_authority_keypair = Keypair::new();

    let initial_config = Config {
        governance_authority:          governance_authority_keypair.pubkey(),
        target_governance_authority:   None,
        wormhole:                      BRIDGE_ID,
        valid_data_sources:            vec![DataSource {
            chain:   0,
            emitter: Pubkey::new_unique(),
        }],
        single_update_fee_in_lamports: 1,
        minimum_signatures:            5,
    };

    program_simulator
        .airdrop(&governance_authority_keypair.pubkey(), LAMPORTS_PER_SOL)
        .await
        .unwrap();

    program_simulator
        .process_ix(
            Initialize::populate(&governance_authority_keypair.pubkey(), initial_config),
            &vec![&governance_authority_keypair],
            None,
        )
        .await
        .unwrap();

    program_simulator
}

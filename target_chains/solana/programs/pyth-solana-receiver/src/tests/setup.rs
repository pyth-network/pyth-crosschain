use {
    crate::ID,
    program_simulator::ProgramBench,
    solana_program_test::read_file,
    std::path::Path,
};

pub async fn start_receiver_test() -> ProgramBench {
    let receiver_bpf_code = read_file(
        std::env::current_dir()
            .unwrap()
            .join(Path::new("../../../target/deploy/pyth_solana_receiver.so")),
    );

    let mut program_bench = ProgramBench::new();
    program_bench.add_bpf_upgradable_program(ID, receiver_bpf_code);

    program_bench
}

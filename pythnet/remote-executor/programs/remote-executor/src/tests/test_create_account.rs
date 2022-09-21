use super::executor_simulator::ExecutorBench;
use anchor_lang::prelude::Pubkey;

#[tokio::test]
async fn test_create_account() {
    let mut bench = ExecutorBench::new();

    let emitter = Pubkey::new_unique();
    let instructions = vec![];

    let vaa_account = bench.add_vaa_account(&emitter, &instructions);

    let mut sim = bench.start().await;

    sim.execute_posted_vaa(&vaa_account).await.unwrap();
}

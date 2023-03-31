use {
    solana_program::{
        program_error::ProgramError,
        pubkey::Pubkey,
        instruction::Instruction,
    },
    crate::pyth_solana_receiver
};
use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::tests::simulator::PythSimulator;
use crate::tests::simulator::sighash;

#[tokio::test]
async fn test_add_price() {

    let mut sim = PythSimulator::new().await;

    let instruction = Instruction::new_with_bytes(sim.program_id, &(pyth_solana_receiver::instruction::Update.data()), vec![]);

    let result = sim.process_ix(instruction, &vec![], &sim.genesis_keypair.insecure_clone()).await.unwrap();

}


/*
#[test]
fn mock_attestation() {
    // TODO: create a VAA with this attestation as payload
    // and then invoke DecodePostedVaa

    let _attestation = PriceAttestation {
        product_id:                 Identifier::new([18u8; 32]),
        price_id:                   Identifier::new([150u8; 32]),
        price:                      0x2bad2feed7,
        conf:                       101,
        ema_price:                  -42,
        ema_conf:                   42,
        expo:                       -3,
        status:                     PriceStatus::Trading,
        num_publishers:             123212u32,
        max_num_publishers:         321232u32,
        attestation_time:           (0xdeadbeeffadeu64) as i64,
        publish_time:               0xdadebeefi64,
        prev_publish_time:          0xdeadbabei64,
        prev_price:                 0xdeadfacebeefi64,
        prev_conf:                  0xbadbadbeefu64,
        last_attested_publish_time: (0xdeadbeeffadedeafu64) as i64,
    };
}
*/

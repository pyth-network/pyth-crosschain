use {
    anyhow::Result,
    borsh::BorshSerialize,
    clap::Parser,
    cli::{
        Action,
        Cli,
    },
    pyth_wormhole_attester_client::{
        get_set_config_ix,
        get_set_is_active_ix,
        Pyth2WormholeConfig,
    },
    remote_executor::state::governance_payload::{
        ExecutorPayload,
        GovernanceHeader,
        InstructionData,
    },
};

mod cli;

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.action {
        Action::GetSetConfig {
            program_id,
            owner,
            payer,
            new_owner,
            wormhole,
            pyth_owner,
            max_batch_size,
            is_active,
            ops_owner,
        } => {
            let new_config = Pyth2WormholeConfig {
                owner: new_owner,
                wh_prog: wormhole,
                pyth_owner,
                max_batch_size,
                is_active,
                ops_owner,
            };
            let ix = get_set_config_ix(&program_id, &owner, &payer, new_config).unwrap();
            let payload = ExecutorPayload {
                header:       GovernanceHeader::executor_governance_header(),
                instructions: vec![InstructionData::from(&ix)],
            }
            .try_to_vec()?;
            println!("Set config payload : {:?}", hex::encode(payload));
            Ok(())
        }
        Action::GetSetIsActive {
            program_id,
            ops_owner,
            payer,
            is_active,
        } => {
            let ix = get_set_is_active_ix(&program_id, &ops_owner, &payer, is_active).unwrap();
            let payload = ExecutorPayload {
                header:       GovernanceHeader::executor_governance_header(),
                instructions: vec![InstructionData::from(&ix)],
            }
            .try_to_vec()?;
            println!("Set is active payload : {:?}", hex::encode(payload));
            Ok(())
        }
    }
}

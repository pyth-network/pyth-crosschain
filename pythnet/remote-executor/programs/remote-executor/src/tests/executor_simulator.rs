use std::collections::HashMap;

use anchor_lang::{
    prelude::{
        Pubkey,
        Rent,
        UpgradeableLoaderState,
    },
    solana_program::hash::Hash,
    AnchorSerialize,
    InstructionData as AnchorInstructionData,
    Key,
    Owner,
    ToAccountMetas,
};
use solana_program_test::{
    find_file,
    read_file,
    BanksClient,
    BanksClientError,
    ProgramTest,
    ProgramTestBanksClientExt,
};
use solana_sdk::{
    account::Account,
    bpf_loader_upgradeable,
    instruction::Instruction,
    signature::Keypair,
    signer::Signer,
    stake_history::Epoch,
    system_instruction,
    transaction::Transaction,
};
use wormhole::Chain;
use wormhole_solana::VAA;

use crate::state::{
    governance_payload::{
        ExecutorPayload,
        GovernanceHeader,
        InstructionData,
    },
    posted_vaa::AnchorVaa,
};

/// Simulator for the state of the pyth program on Solana. You can run solana transactions against
/// this struct to test how pyth instructions execute in the Solana runtime.
pub struct ExecutorBench {
    program_test: ProgramTest,
    program_id: Pubkey,
    seqno: HashMap<Pubkey, u64>,
}

impl ExecutorBench {
    /// Deploys the executor program as upgradable
    pub fn new() -> ExecutorBench {
        let mut bpf_data = read_file(find_file("remote_executor.so").unwrap_or_else(|| {
            panic!("Unable to locate {}", "remote_executor.so");
        }));

        let mut program_test = ProgramTest::default();
        let program_key = crate::id();
        let programdata_key = Pubkey::new_unique();

        let upgrade_authority_keypair = Keypair::new();

        let program_deserialized = UpgradeableLoaderState::Program {
            programdata_address: programdata_key,
        };
        let programdata_deserialized = UpgradeableLoaderState::ProgramData {
            slot: 1,
            upgrade_authority_address: Some(upgrade_authority_keypair.pubkey()),
        };

        // Program contains a pointer to progradata
        let program_vec = bincode::serialize(&program_deserialized).unwrap();
        // Programdata contains a header and the binary of the program
        let mut programdata_vec = bincode::serialize(&programdata_deserialized).unwrap();
        programdata_vec.append(&mut bpf_data);

        let program_account = Account {
            lamports: Rent::default().minimum_balance(program_vec.len()),
            data: program_vec,
            owner: bpf_loader_upgradeable::ID,
            executable: true,
            rent_epoch: Epoch::default(),
        };
        let programdata_account = Account {
            lamports: Rent::default().minimum_balance(programdata_vec.len()),
            data: programdata_vec,
            owner: bpf_loader_upgradeable::ID,
            executable: false,
            rent_epoch: Epoch::default(),
        };

        // Add to both accounts to program test, now the program is deployed as upgradable
        program_test.add_account(program_key, program_account);
        program_test.add_account(programdata_key, programdata_account);

        return ExecutorBench {
            program_test,
            program_id: program_key.key(),
            seqno: HashMap::<Pubkey, u64>::new(),
        };
    }

    pub async fn start(self) -> ExecutorSimulator {
        // Start validator
        let (banks_client, genesis_keypair, recent_blockhash) = self.program_test.start().await;

        // Anchor Program
        return ExecutorSimulator {
            banks_client,
            payer: genesis_keypair,
            last_blockhash: recent_blockhash,
            program_id: self.program_id,
        };
    }

    pub fn add_vaa_account(&mut self, emitter: &Pubkey, instructions: &Vec<Instruction>) -> Pubkey {
        let payload = ExecutorPayload {
            header: GovernanceHeader::default(),
            instructions: instructions
                .iter()
                .map(|x| InstructionData::from(x))
                .collect(),
        };

        let payload_bytes = payload.try_to_vec().unwrap();

        let vaa = VAA {
            vaa_version: 0,
            consistency_level: 0,
            vaa_time: 0,
            vaa_signature_account: Pubkey::new_unique(),
            submission_time: 0,
            nonce: 0,
            sequence: self.seqno.get(&emitter).unwrap_or(&0) + 1,
            emitter_chain: Chain::Solana.into(),
            emitter_address: emitter.to_bytes(),
            payload: payload_bytes,
        };

        let vaa_bytes = vaa.try_to_vec().unwrap();

        let vaa_account = Account {
            lamports: Rent::default().minimum_balance(vaa_bytes.len()),
            data: vaa_bytes,
            owner: AnchorVaa::owner(),
            executable: false,
            rent_epoch: Epoch::default(),
        };

        let vaa_pubkey = Pubkey::new_unique();
        self.program_test.add_account(vaa_pubkey, vaa_account);
        return vaa_pubkey;
    }
}
pub struct ExecutorSimulator {
    banks_client: BanksClient,
    payer: Keypair,
    last_blockhash: Hash,
    pub program_id: Pubkey,
}

impl ExecutorSimulator {
    #[allow(dead_code)]
    pub async fn airdrop(&mut self, to: &Pubkey, lamports: u64) -> Result<(), BanksClientError> {
        let instruction = system_instruction::transfer(&self.payer.pubkey(), to, lamports);

        self.process_ix(instruction, &vec![]).await
    }

    /// Process a transaction containing `instruction` signed by `signers`.
    /// `payer` is used to pay for and sign the transaction.
    async fn process_ix(
        &mut self,
        instruction: Instruction,
        signers: &Vec<&Keypair>,
    ) -> Result<(), BanksClientError> {
        let mut transaction =
            Transaction::new_with_payer(&[instruction], Some(&self.payer.pubkey()));

        let blockhash = self
            .banks_client
            .get_new_latest_blockhash(&self.last_blockhash)
            .await
            .unwrap();
        self.last_blockhash = blockhash;

        transaction.partial_sign(&[&self.payer], self.last_blockhash);
        transaction.partial_sign(signers, self.last_blockhash);

        self.banks_client.process_transaction(transaction).await
    }

    pub async fn execute_posted_vaa(
        &mut self,
        posted_vaa_address: &Pubkey,
    ) -> Result<(), BanksClientError> {
        let posted_vaa_data: VAA = self
            .banks_client
            .get_account_data_with_borsh(*posted_vaa_address)
            .await
            .unwrap();
        let account_metas = crate::accounts::ExecutePostedVaa::populate(
            &self.program_id,
            &self.payer.pubkey(),
            &Pubkey::new(&posted_vaa_data.emitter_address),
            &posted_vaa_address,
        )
        .to_account_metas(None);
        let instruction = Instruction {
            program_id: self.program_id,
            accounts: account_metas,
            data: crate::instruction::ExecutePostedVaa.data(),
        };

        self.process_ix(instruction, &vec![]).await
    }
}

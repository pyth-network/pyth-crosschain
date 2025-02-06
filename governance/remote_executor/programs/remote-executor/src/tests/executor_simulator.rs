use {
    crate::{
        error::ExecutorError,
        state::{
            claim_record::ClaimRecord,
            governance_payload::{ExecutorPayload, GovernanceHeader, InstructionData, CHAIN_ID},
            posted_vaa::AnchorVaa,
        },
        CLAIM_RECORD_SEED, EXECUTOR_KEY_SEED,
    },
    anchor_lang::{
        prelude::{AccountMeta, ProgramError, Pubkey, Rent},
        solana_program::hash::Hash,
        AccountDeserialize, AnchorDeserialize, AnchorSerialize,
        InstructionData as AnchorInstructionData, Key, Owner, ToAccountMetas,
    },
    solana_program_test::{
        read_file, BanksClient, BanksClientError, ProgramTest, ProgramTestBanksClientExt,
    },
    solana_sdk::{
        account::Account,
        bpf_loader,
        instruction::{Instruction, InstructionError},
        signature::Keypair,
        signer::Signer,
        stake_history::Epoch,
        system_instruction,
        transaction::{Transaction, TransactionError},
    },
    std::{collections::HashMap, path::Path},
    wormhole_sdk::Chain,
    wormhole_solana::VAA,
};

/// Bench for the tests, the goal of this struct is to be able to setup solana accounts before starting the local validator
pub struct ExecutorBench {
    program_test: ProgramTest,
    program_id: Pubkey,
    seqno: HashMap<Pubkey, u64>,
}

/// When passed to `add_vaa_account` modify the posted vaa in a way that makes the vaa invalid
/// - `WrongOwner` : the owner is not the wormhole bridge
/// - `WrongData` : data is random bytes
/// - `WrongEmitterChain` : emitter chain of the vaa is ethereum
pub enum VaaAttack {
    None,
    WrongOwner,
    WrongData,
    WrongEmitterChain,
    WrongVaaMagic,
}

impl ExecutorBench {
    /// Deploys the executor program as upgradable
    pub fn new() -> ExecutorBench {
        let bpf_data = read_file(
            std::env::current_dir()
                .unwrap()
                .join(Path::new("../../target/deploy/remote_executor.so")),
        );

        let mut program_test = ProgramTest::default();
        let program_key = crate::id();

        let program_account = Account {
            lamports: Rent::default().minimum_balance(bpf_data.len()),
            data: bpf_data,
            owner: bpf_loader::ID,
            executable: true,
            rent_epoch: Epoch::default(),
        };

        program_test.add_account(program_key, program_account);

        ExecutorBench {
            program_test,
            program_id: program_key.key(),
            seqno: HashMap::<Pubkey, u64>::new(),
        }
    }

    /// Start local validator based on the current bench
    pub async fn start(self) -> ExecutorSimulator {
        // Start validator
        let (banks_client, genesis_keypair, recent_blockhash) = self.program_test.start().await;

        ExecutorSimulator {
            banks_client,
            payer: genesis_keypair,
            last_blockhash: recent_blockhash,
            program_id: self.program_id,
        }
    }

    /// Add VAA account with emitter and instructions for consumption by the remote_executor
    pub fn add_vaa_account(
        &mut self,
        emitter: &Pubkey,
        instructions: &[Instruction],
        validity: VaaAttack,
    ) -> Pubkey {
        let emitter_chain: u16 = match validity {
            VaaAttack::WrongEmitterChain => Chain::Ethereum.into(),
            _ => Chain::Solana.into(),
        };

        let vaa_magic = match validity {
            VaaAttack::WrongVaaMagic => b"xxx",
            _ => b"vaa",
        };

        let owner: Pubkey = match validity {
            VaaAttack::WrongOwner => Pubkey::new_unique(),
            _ => AnchorVaa::owner(),
        };

        let payload = ExecutorPayload {
            header: GovernanceHeader::executor_governance_header(CHAIN_ID),
            instructions: instructions.iter().map(InstructionData::from).collect(),
        };

        let payload_bytes = payload.try_to_vec().unwrap();

        let vaa = AnchorVaa {
            magic: *vaa_magic,
            vaa: VAA {
                vaa_version: 0,
                consistency_level: 0,
                vaa_time: 0,
                vaa_signature_account: Pubkey::new_unique(),
                submission_time: 0,
                nonce: 0,
                sequence: self.seqno.get(emitter).unwrap_or(&0) + 1,
                emitter_chain,
                emitter_address: emitter.to_bytes(),
                payload: payload_bytes,
            },
        };

        *self.seqno.entry(*emitter).or_insert(0) += 1;

        let vaa_bytes = vaa.try_to_vec().unwrap();

        let data: Vec<u8> = match validity {
            VaaAttack::WrongData => (0..vaa_bytes.len()).map(|_| rand::random::<u8>()).collect(),
            _ => vaa_bytes,
        };

        let vaa_account = Account {
            lamports: Rent::default().minimum_balance(data.len()),
            data,
            owner,
            executable: false,
            rent_epoch: Epoch::default(),
        };

        let vaa_pubkey = Pubkey::new_unique();
        self.program_test.add_account(vaa_pubkey, vaa_account);
        vaa_pubkey
    }

    // Get executor key of an emitter, useful to construct instructions that will be in the VAA
    pub fn get_executor_key(&self, emitter: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(
            &[EXECUTOR_KEY_SEED.as_bytes(), &emitter.to_bytes()],
            &self.program_id,
        )
        .0
    }

    // Get claim record of an emitter
    pub fn get_claim_record_key(&self, emitter: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(
            &[CLAIM_RECORD_SEED.as_bytes(), &emitter.to_bytes()],
            &self.program_id,
        )
        .0
    }
}
pub struct ExecutorSimulator {
    banks_client: BanksClient,
    payer: Keypair,
    last_blockhash: Hash,
    program_id: Pubkey,
}

/// When passed to execute_posted_vaa, try to impersonate some of the accounts
/// - WrongVaaAddress(Pubkey) : pass the VAA address specified
/// - WrongEmptyClaimAddress : pass a claim_record address that is a PDA of the program but with the wrong seeds and also an empty account
/// - WrongClaimAddress(Pubkey) : pass the claim_record specified
/// - WrongSystemProgram : pass a random pubkey as the system program
pub enum ExecutorAttack {
    None,
    WrongVaaAddress(Pubkey),
    WrongEmptyClaimAddress,
    WrongClaimAddress(Pubkey),
    WrongSystemProgram,
}

impl ExecutorSimulator {
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

    /// Execute the payload contained in the VAA at posted_vaa_address
    pub async fn execute_posted_vaa(
        &mut self,
        posted_vaa_address: &Pubkey,
        signers: &Vec<&Keypair>,
        executor_attack: ExecutorAttack,
    ) -> Result<(), BanksClientError> {
        let posted_vaa_data: AnchorVaa = AnchorVaa::try_from_slice(
            &self
                .banks_client
                .get_account(*posted_vaa_address)
                .await
                .unwrap()
                .unwrap()
                .data[..],
        )
        .unwrap();

        let mut account_metas = crate::accounts::ExecutePostedVaa::populate(
            &self.program_id,
            &self.payer.pubkey(),
            &Pubkey::from(posted_vaa_data.emitter_address),
            posted_vaa_address,
        )
        .to_account_metas(None);

        // ExecutorAttack overrides
        match executor_attack {
            ExecutorAttack::WrongVaaAddress(key) => account_metas[1].pubkey = key,
            ExecutorAttack::WrongEmptyClaimAddress => {
                account_metas[2].pubkey = Pubkey::find_program_address(
                    &[
                        CLAIM_RECORD_SEED.as_bytes(),
                        &Pubkey::new_unique().to_bytes(),
                    ],
                    &self.program_id,
                )
                .0
            }
            ExecutorAttack::WrongClaimAddress(key) => account_metas[2].pubkey = key,
            ExecutorAttack::WrongSystemProgram => account_metas[3].pubkey = Pubkey::new_unique(),
            _ => {}
        };

        let executor_payload: ExecutorPayload =
            AnchorDeserialize::try_from_slice(posted_vaa_data.payload.as_slice()).unwrap();

        let executor_key = Pubkey::find_program_address(
            &[
                EXECUTOR_KEY_SEED.as_bytes(),
                &posted_vaa_data.emitter_address,
            ],
            &self.program_id,
        )
        .0;

        // We need to add `executor_key` to the list of accounts
        account_metas.push(AccountMeta {
            pubkey: executor_key,
            is_signer: false,
            is_writable: true,
        });

        // Add the rest of `remaining_accounts` from parsing the payload
        for instruction in executor_payload.instructions {
            // Push program_id
            account_metas.push(AccountMeta {
                pubkey: instruction.program_id,
                is_signer: false,
                is_writable: false,
            });
            // Push other accounts
            for account_meta in Instruction::from(&instruction).accounts {
                if account_meta.pubkey != executor_key {
                    account_metas.push(account_meta.clone());
                }
            }
        }

        let instruction = Instruction {
            program_id: self.program_id,
            accounts: account_metas,
            data: crate::instruction::ExecutePostedVaa.data(),
        };

        self.process_ix(instruction, signers).await
    }

    /// Get the account at `key`. Returns `None` if no such account exists.
    pub async fn get_account(&mut self, key: Pubkey) -> Option<Account> {
        self.banks_client.get_account(key).await.unwrap()
    }

    /// Get claim record
    #[allow(dead_code)]
    pub async fn get_claim_record(&mut self, emitter: Pubkey) -> ClaimRecord {
        let claim_record_key = Pubkey::find_program_address(
            &[CLAIM_RECORD_SEED.as_bytes(), &emitter.to_bytes()],
            &self.program_id,
        )
        .0;

        let account = self.get_account(claim_record_key).await.unwrap();
        ClaimRecord::try_deserialize(&mut account.data.as_slice()).unwrap()
    }
}

impl From<ExecutorError> for TransactionError {
    fn from(val: ExecutorError) -> Self {
        TransactionError::InstructionError(
            0,
            InstructionError::try_from(u64::from(ProgramError::from(
                anchor_lang::prelude::Error::from(val),
            )))
            .unwrap(),
        )
    }
}

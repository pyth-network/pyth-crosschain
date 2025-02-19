use {
    anchor_lang::{
        prelude::{ProgramError::Custom, *},
        solana_program::{
            hash::hashv,
            instruction::{Instruction, InstructionError},
        },
        Id,
    },
    byteorder::{BigEndian, LittleEndian, ReadBytesExt},
    message_buffer::instructions::{MESSAGE, WHITELIST},
    solana_program_test::{BanksClientError, ProgramTest, ProgramTestContext},
    solana_sdk::{
        account::ReadableAccount,
        signature::{Keypair, Signer},
        transaction::{Transaction, TransactionError},
    },
    std::{
        io::{Cursor, Read},
        str::FromStr,
    },
};

pub struct MessageBufferTestContext {
    context: ProgramTestContext,
    pub payer: Keypair,
    admin: Option<Keypair>,
    whitelist: Option<Pubkey>,
}

impl MessageBufferTestContext {
    pub const DEFAULT_TEST_PRICE_ID: u64 = 0u64;
    pub const DEFAULT_TARGET_SIZE: u32 = 1024;
    pub const DEFAULT_ADD_PRICE_PARAMS: AddPriceParams = (
        MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
        2u64,
        3u64,
        4u64,
        5u64,
    );

    pub async fn initialize_context(disable_loosen_cpi_limit: bool) -> Self {
        let log_filter = "solana_rbpf=trace,\
                    solana_runtime::message_processor=trace,\
                    solana_runtime::system_instruction_processor=trace,\
                    solana_program_test=debug";
        solana_logger::setup_with(log_filter);

        let mut pt = ProgramTest::new("message_buffer", ::message_buffer::id(), None);
        pt.add_program("mock_cpi_caller", ::mock_cpi_caller::id(), None);
        if disable_loosen_cpi_limit {
            pt.deactivate_feature(
                Pubkey::from_str("GDH5TVdbTPUpRnXaRyQqiKUa7uZAbZ28Q2N9bhbKoMLm").unwrap(),
            );
        }

        let context = pt.start_with_context().await;

        let payer = context.payer.insecure_clone();

        Self {
            context,
            payer,
            admin: None,
            whitelist: None,
        }
    }

    // Initialize with test default helper functions //
    pub async fn initialize_with_default_test_allowed_programs(
        disable_loosen_cpi_limit: bool,
    ) -> Result<Self> {
        let mut context = Self::initialize_context(disable_loosen_cpi_limit).await;
        let admin = Keypair::new();
        context.initialize(&admin).await.unwrap();
        context
            .set_allowed_programs(&Self::default_allowed_programs())
            .await
            .unwrap();
        Ok(context)
    }

    pub async fn initialize_with_default_test_buffer(
        disable_loosen_cpi_limit: bool,
        target_size: u32,
    ) -> Result<Self> {
        let mut context =
            Self::initialize_with_default_test_allowed_programs(disable_loosen_cpi_limit)
                .await
                .unwrap();
        context
            .create_buffer(Self::DEFAULT_TEST_PRICE_ID, target_size)
            .await
            .unwrap();
        Ok(context)
    }

    pub async fn get_balance(&mut self, pubkey: Pubkey) -> u64 {
        self.context.banks_client.get_balance(pubkey).await.unwrap()
    }

    pub fn admin(&self) -> Keypair {
        self.admin.as_ref().unwrap().insecure_clone()
    }

    fn admin_pubkey(&self) -> Pubkey {
        self.admin.as_ref().unwrap().pubkey()
    }

    pub fn whitelist(&self) -> Pubkey {
        self.whitelist.unwrap()
    }

    pub fn get_mock_cpi_auth() -> Pubkey {
        let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
            &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
            &::mock_cpi_caller::id(),
        );
        mock_cpi_caller_auth
    }

    pub fn default_allowed_programs() -> Vec<Pubkey> {
        vec![MessageBufferTestContext::get_mock_cpi_auth()]
    }

    pub fn default_pyth_price_account() -> Pubkey {
        Self::get_mock_pyth_price_account(Self::DEFAULT_TEST_PRICE_ID)
    }

    pub fn get_mock_pyth_price_account(id: u64) -> Pubkey {
        let (mock_pyth_price_acct, _) = Pubkey::find_program_address(
            &[b"pyth".as_ref(), b"price".as_ref(), &id.to_le_bytes()],
            &::mock_cpi_caller::id(),
        );
        mock_pyth_price_acct
    }

    pub fn default_msg_buffer() -> (Pubkey, u8) {
        find_msg_buffer_pda(
            Self::get_mock_cpi_auth(),
            Self::default_pyth_price_account(),
        )
    }

    pub async fn process_ixs(
        &mut self,
        instructions: &[Instruction],
        signers: Vec<&Keypair>,
    ) -> anchor_lang::Result<()> {
        let recent_blockhash = self.context.get_new_latest_blockhash().await.unwrap();

        let mut transaction = Transaction::new_with_payer(instructions, Some(&self.payer.pubkey()));
        transaction.partial_sign(&[&self.payer], recent_blockhash);
        transaction.partial_sign(&signers, recent_blockhash);

        let res = self
            .context
            .banks_client
            .process_transaction(transaction)
            .await;
        match res {
            Err(BanksClientError::TransactionError(TransactionError::InstructionError(
                _,
                InstructionError::Custom(error_code),
            ))) => {
                let e = Custom(error_code);
                Err(e.into())
            }
            Err(e) => {
                println!("process_ixs Error: {:?}", e);
                panic!("Non Custom Ix Error in process_ixs{:?}", e);
            }
            Ok(_) => Ok(()),
        }
    }

    pub async fn initialize(&mut self, admin: &Keypair) -> Result<(Pubkey, u8)> {
        let (whitelist_pda, whitelist_bump) = Pubkey::find_program_address(
            &[MESSAGE.as_bytes(), WHITELIST.as_bytes()],
            &::message_buffer::id(),
        );

        self.admin = Some(admin.insecure_clone());
        self.whitelist = Some(whitelist_pda);

        let init_message_buffer_ix =
            initialize_ix(admin.pubkey(), self.payer.pubkey(), whitelist_pda);

        self.process_ixs(
            &[init_message_buffer_ix],
            vec![&self.admin.as_ref().unwrap().insecure_clone()],
        )
        .await
        .unwrap();

        Ok((whitelist_pda, whitelist_bump))
    }

    pub async fn fetch_whitelist(&mut self) -> Result<(u8, Pubkey, u32, Vec<Pubkey>)> {
        let whitelist_account = self
            .context
            .banks_client
            .get_account(self.whitelist())
            .await
            .unwrap();
        assert!(whitelist_account.is_some());
        let whitelist_account = whitelist_account.unwrap();
        let account_data = whitelist_account.data();

        deserialize_whitelist(account_data)
    }

    pub async fn set_allowed_programs(&mut self, allowed_programs: &Vec<Pubkey>) -> Result<()> {
        let set_allowed_programs_ix =
            set_allowed_programs_ix(self.admin_pubkey(), self.whitelist(), allowed_programs);

        self.process_ixs(
            &[set_allowed_programs_ix],
            vec![&self.admin.as_ref().unwrap().insecure_clone()],
        )
        .await
        .unwrap();
        Ok(())
    }

    pub async fn create_buffer(&mut self, id: u64, target_size: u32) -> Result<(Pubkey, u8)> {
        let pyth_price_account = Self::get_mock_pyth_price_account(id);
        let (msg_buffer_pda, msg_buffer_bump) =
            find_msg_buffer_pda(Self::get_mock_cpi_auth(), pyth_price_account);

        let admin = self.admin.as_ref().unwrap().insecure_clone();
        let create_msg_buffer_ix = create_msg_buffer_ix(
            Self::get_mock_cpi_auth(),
            pyth_price_account,
            target_size,
            self.whitelist(),
            admin.pubkey(),
            self.payer.pubkey(),
            msg_buffer_pda,
        );
        self.process_ixs(&[create_msg_buffer_ix], vec![&admin])
            .await?;

        Ok((msg_buffer_pda, msg_buffer_bump))
    }

    pub async fn fetch_msg_buffer_account_data(&mut self, msg_buffer: &Pubkey) -> Option<Vec<u8>> {
        let msg_buffer_account = self
            .context
            .banks_client
            .get_account(*msg_buffer)
            .await
            .unwrap();

        msg_buffer_account.map(|a| a.data)
    }

    pub async fn delete_buffer(&mut self, id: u64) -> anchor_lang::Result<()> {
        let pyth_price_account = Self::get_mock_pyth_price_account(id);

        let (msg_buffer_pda, _) =
            find_msg_buffer_pda(Self::get_mock_cpi_auth(), pyth_price_account);
        let admin = self.admin();

        let delete_ix = delete_msg_buffer_ix(
            Self::get_mock_cpi_auth(),
            pyth_price_account,
            self.whitelist(),
            admin.pubkey(),
            self.payer.pubkey(),
            msg_buffer_pda,
        );

        self.process_ixs(&[delete_ix], vec![&admin]).await?;
        Ok(())
    }

    pub async fn resize_msg_buffer(
        &mut self,
        id: u64,
        target_sizes: Vec<u32>,
    ) -> anchor_lang::Result<()> {
        let pyth_price_account = Self::get_mock_pyth_price_account(id);
        let (msg_buffer_pda, _) =
            find_msg_buffer_pda(Self::get_mock_cpi_auth(), pyth_price_account);

        let resize_ixs = &mut vec![];

        let admin = self.admin.as_ref().unwrap().insecure_clone();

        for target_size in target_sizes {
            let resize_ix = resize_msg_buffer_ix(
                Self::get_mock_cpi_auth(),
                pyth_price_account,
                target_size,
                self.whitelist(),
                admin.pubkey(),
                self.payer.pubkey(),
                msg_buffer_pda,
            );
            resize_ixs.push(resize_ix);
        }

        self.process_ixs(resize_ixs, vec![&admin]).await?;
        Ok(())
    }

    pub async fn add_price(
        &mut self,
        add_price_params: AddPriceParams,
        payer: Pubkey,
        whitelist: Pubkey,
        cpi_auth: Pubkey,
    ) -> Result<()> {
        let (id, price, price_expo, ema, ema_expo) = add_price_params;
        let pyth_price_account = Self::get_mock_pyth_price_account(id);
        let (msg_buffer_pda, _) = find_msg_buffer_pda(cpi_auth, pyth_price_account);

        let add_price_ix = add_price_ix(
            id,
            price,
            price_expo,
            ema,
            ema_expo,
            pyth_price_account,
            payer,
            whitelist,
            cpi_auth,
            msg_buffer_pda,
        );

        self.process_ixs(&[add_price_ix], vec![]).await?;
        Ok(())
    }
}

pub type AddPriceParams = (u64, u64, u64, u64, u64);

fn initialize_ix(admin: Pubkey, payer: Pubkey, whitelist_pda: Pubkey) -> Instruction {
    let init_ix_discriminator = sighash("global", "initialize");

    Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(init_ix_discriminator),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(payer, true),
            AccountMeta::new(whitelist_pda, false),
            AccountMeta::new_readonly(System::id(), false),
        ],
    )
}

fn set_allowed_programs_ix(
    admin: Pubkey,
    whitelist: Pubkey,
    allowed_programs: &Vec<Pubkey>,
) -> Instruction {
    let ix_discriminator = sighash("global", "set_allowed_programs");

    Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(ix_discriminator, allowed_programs),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(whitelist, false),
        ],
    )
}

pub fn create_msg_buffer_ix(
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    target_size: u32,
    whitelist: Pubkey,
    admin: Pubkey,
    payer: Pubkey,
    msg_buffer_pda: Pubkey,
) -> Instruction {
    let create_ix_discriminator = sighash("global", "create_buffer");

    Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(
            create_ix_discriminator,
            cpi_caller_auth,
            pyth_price_acct,
            target_size,
        ),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    )
}

pub fn resize_msg_buffer_ix(
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    target_size: u32,
    whitelist: Pubkey,
    admin: Pubkey,
    payer: Pubkey,
    msg_buffer_pda: Pubkey,
) -> Instruction {
    let resize_ix_disc = sighash("global", "resize_buffer");

    Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(
            resize_ix_disc,
            cpi_caller_auth,
            pyth_price_acct,
            target_size,
        ),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    )
}

pub fn delete_msg_buffer_ix(
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    whitelist: Pubkey,
    admin: Pubkey,
    payer: Pubkey,
    msg_buffer_pda: Pubkey,
) -> Instruction {
    let delete_ix_disc = sighash("global", "delete_buffer");

    Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(delete_ix_disc, cpi_caller_auth, pyth_price_acct),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(payer, true),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    )
}

fn add_price_ix(
    id: u64,
    price: u64,
    price_expo: u64,
    ema: u64,
    ema_expo: u64,
    pyth_price_account: Pubkey,
    payer: Pubkey,
    whitelist: Pubkey,
    cpi_auth: Pubkey,
    msg_buffer_pda: Pubkey,
) -> Instruction {
    let add_price_disc = sighash("global", "add_price");
    Instruction::new_with_borsh(
        ::mock_cpi_caller::id(),
        &(add_price_disc, id, price, price_expo, ema, ema_expo),
        vec![
            AccountMeta::new(pyth_price_account, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new_readonly(cpi_auth, false),
            AccountMeta::new_readonly(::message_buffer::id(), false),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    )
}

type Bump = u8;
type Version = u8;
type HeaderLen = u16;
type EndOffsets = [u16; 255];

pub fn deserialize_msg_buffer_header(
    account_data: &[u8],
) -> (Bump, Version, HeaderLen, EndOffsets) {
    let mut cursor = Cursor::new(account_data);
    let discriminator = &mut vec![0u8; 8];
    cursor.read_exact(discriminator).unwrap();
    assert_eq!(discriminator, &sighash("account", "MessageBuffer"));

    let msg_buffer_acct_bump = cursor.read_u8().unwrap();
    let version = cursor.read_u8().unwrap();
    let header_len = cursor.read_u16::<LittleEndian>().unwrap();
    let mut end_offsets = [0u16; 255];
    for i in 0..255 {
        let cur_end_offset = cursor.read_u16::<LittleEndian>().unwrap();
        end_offsets[i] = cur_end_offset;
    }

    let mut messages = vec![];
    cursor.read_to_end(&mut messages).unwrap();

    (msg_buffer_acct_bump, version, header_len, end_offsets)
}

pub fn extract_msg_buffer_messages(
    header_len: u16,
    end_offsets: EndOffsets,
    account_data: &[u8],
) -> Vec<Vec<u8>> {
    let mut msgs = vec![];
    let mut msg_begin = header_len;
    for end_offset in end_offsets {
        if end_offset == 0 {
            break;
        }
        let msg_end = header_len + end_offset;
        msgs.push(account_data[(msg_begin as usize)..(msg_end as usize)].to_vec());
        msg_begin = msg_end;
    }
    msgs
}

pub fn sighash(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{namespace}:{name}");

    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hashv(&[preimage.as_bytes()]).to_bytes()[..8]);
    sighash
}

// price::MessageHeader
type PriceMsgSchema = u8;
type PriceMsgVersion = u16;
type PriceMsgSize = u32;

pub fn validate_price_msgs(
    id: u64,
    price: u64,
    price_expo: u64,
    ema: u64,
    ema_expo: u64,
    msgs: &Vec<Vec<u8>>,
) -> Result<()> {
    for msg in msgs {
        let (schema, _, _) = deserialize_price_msg_header(msg);
        match schema {
            0 => verify_full_price_msg(id, price, price_expo, ema, ema_expo, msg)?,
            1 => verify_compact_price_msg(id, price, price_expo, msg)?,
            _ => panic!(),
        }
    }
    Ok(())
}

pub fn verify_full_price_msg(
    id: u64,
    price: u64,
    price_expo: u64,
    ema: u64,
    ema_expo: u64,
    msg: &[u8],
) -> Result<()> {
    let mut cursor = Cursor::new(&msg[7..]);
    let msg_id = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(id, msg_id);
    let msg_price = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(price, msg_price);
    let msg_price_expo = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(price_expo, msg_price_expo);
    let msg_ema = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(ema, msg_ema);
    let msg_ema_expo = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(ema_expo, msg_ema_expo);
    Ok(())
}

pub fn verify_compact_price_msg(id: u64, price: u64, price_expo: u64, msg: &[u8]) -> Result<()> {
    let mut cursor = Cursor::new(&msg[7..]);
    let msg_id = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(id, msg_id);
    let msg_price = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(price, msg_price);
    let msg_price_expo = cursor.read_u64::<BigEndian>().unwrap();
    assert_eq!(price_expo, msg_price_expo);
    Ok(())
}

pub fn validate_dummy_price_msgs(_msgs: &[&[u8]], _msg_sizes: &Vec<u16>) -> Result<()> {
    Ok(())
}

pub fn deserialize_price_msg_header(msg: &[u8]) -> (PriceMsgSchema, PriceMsgVersion, PriceMsgSize) {
    let mut cursor = Cursor::new(msg);
    let schema = cursor.read_u8().unwrap();
    let version = cursor.read_u16::<BigEndian>().unwrap();
    let size = cursor.read_u32::<BigEndian>().unwrap();
    (schema, version, size)
}

pub fn find_msg_buffer_pda(cpi_caller_auth: Pubkey, pyth_price_acct: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            cpi_caller_auth.as_ref(),
            MESSAGE.as_bytes(),
            pyth_price_acct.as_ref(),
        ],
        &::message_buffer::id(),
    )
}

pub fn deserialize_whitelist(account_data: &[u8]) -> Result<(u8, Pubkey, u32, Vec<Pubkey>)> {
    let mut cursor = Cursor::new(account_data);
    let discriminator = &mut vec![0u8; 8];
    cursor.read_exact(discriminator).unwrap();
    assert_eq!(discriminator, &sighash("account", "Whitelist"));

    let whitelist_acct_bump = cursor.read_u8().unwrap();

    let admin_bytes = &mut vec![0u8; 32];
    cursor.read_exact(admin_bytes).unwrap();
    let admin_pubkey = Pubkey::try_from_slice(admin_bytes).unwrap();

    let allowed_programs_len = cursor.read_u32::<LittleEndian>().unwrap();

    let mut allowed_programs = vec![];
    for _ in 0..allowed_programs_len {
        let allowed_program_bytes = &mut vec![0u8; 32];
        cursor.read_exact(allowed_program_bytes).unwrap();
        let allowed_program_pubkey = Pubkey::try_from_slice(allowed_program_bytes).unwrap();
        allowed_programs.push(allowed_program_pubkey);
    }
    Ok((
        whitelist_acct_bump,
        admin_pubkey,
        allowed_programs_len,
        allowed_programs,
    ))
}

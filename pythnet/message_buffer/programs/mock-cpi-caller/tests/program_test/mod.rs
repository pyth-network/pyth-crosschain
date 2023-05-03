use {
    anchor_lang::{
        prelude::*,
        solana_program::{
            hash::hashv,
            instruction::Instruction,
        },
        Id,
    },
    byteorder::{
        BigEndian,
        LittleEndian,
        ReadBytesExt,
    },
    solana_program_test::{
        BanksClient,
        ProgramTest,
        ProgramTestContext,
    },
    solana_sdk::{
        account::ReadableAccount,
        signature::{
            Keypair,
            Signer,
        },
        transaction::Transaction,
    },
    std::{
        io::{
            Cursor,
            Read,
        },
        str::FromStr,
    },
};

pub async fn setup_program_test(disable_loosen_cpi_limit: bool) -> ProgramTestContext {
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

    pt.start_with_context().await
}

fn initialize_ix(
    admin: Pubkey,
    payer: Pubkey,
    whitelist_pda: Pubkey,
) -> anchor_lang::Result<Instruction> {
    let init_ix_discriminator = sighash("global", "initialize");

    let init_message_buffer_ix = Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(init_ix_discriminator, admin),
        vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(whitelist_pda, false),
            AccountMeta::new_readonly(System::id(), false),
        ],
    );
    Ok(init_message_buffer_ix)
}

pub async fn send_initialize_whitelist(
    banks_client: &mut BanksClient,
    admin: Pubkey,
    payer: &Keypair,
) -> anchor_lang::Result<(Pubkey, u8)> {
    let (whitelist_pda, whitelist_bump) = Pubkey::find_program_address(
        &[b"message".as_ref(), b"whitelist".as_ref()],
        &::message_buffer::id(),
    );

    let init_message_buffer_ix = initialize_ix(admin, payer.pubkey(), whitelist_pda)?;

    send_transaction(
        banks_client,
        &[init_message_buffer_ix],
        payer.pubkey(),
        vec![payer],
    )
    .await
    .unwrap();

    Ok((whitelist_pda, whitelist_bump))
}

fn set_allowed_programs_ix(
    admin: Pubkey,
    payer: Pubkey,
    whitelist: Pubkey,
    allowed_programs: &Vec<Pubkey>,
) -> anchor_lang::Result<Instruction> {
    let ix_discriminator = sighash("global", "set_allowed_programs");

    let set_allowed_programs_ix = Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(ix_discriminator, allowed_programs),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(payer, true),
            AccountMeta::new(whitelist, false),
        ],
    );
    Ok(set_allowed_programs_ix)
}

pub async fn send_set_allowed_programs(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    whitelist: &Pubkey,
    allowed_programs: &Vec<Pubkey>,
) -> anchor_lang::Result<()> {
    let _recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();

    let set_allowed_programs_ix =
        set_allowed_programs_ix(payer.pubkey(), payer.pubkey(), *whitelist, allowed_programs)?;

    send_transaction(
        banks_client,
        &[set_allowed_programs_ix],
        payer.pubkey(),
        vec![payer],
    )
    .await
    .unwrap();

    Ok(())
}

async fn create_msg_buffer_ix(
    admin: Pubkey,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    target_size: u32,
) -> anchor_lang::Result<(Pubkey, u8, Instruction)> {
    let (msg_buffer_pda, msg_buffer_bump) = Pubkey::find_program_address(
        &[
            cpi_caller_auth.as_ref(),
            b"message".as_ref(),
            pyth_price_acct.as_ref(),
        ],
        &::message_buffer::id(),
    );


    let create_ix_discriminator = sighash("global", "create_buffer");

    let create_msg_buffer_ix = Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(
            create_ix_discriminator,
            cpi_caller_auth,
            pyth_price_acct,
            target_size,
        ),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new(admin, true),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    );
    Ok((msg_buffer_pda, msg_buffer_bump, create_msg_buffer_ix))
}

pub async fn send_create_msg_buffer(
    banks_client: &mut BanksClient,
    admin: &Keypair,
    payer: &Keypair,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    target_size: u32,
) -> anchor_lang::Result<(Pubkey, u8)> {
    let (msg_buffer_pda, msg_buffer_bump, create_msg_buffer_ix) = create_msg_buffer_ix(
        admin.pubkey(),
        whitelist,
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
    )
    .await
    .unwrap();

    send_transaction(
        banks_client,
        &[create_msg_buffer_ix],
        payer.pubkey(),
        vec![admin, payer],
    )
    .await
    .unwrap();

    Ok((msg_buffer_pda, msg_buffer_bump))
}


pub async fn resize_msg_buffer_ix(
    admin: Pubkey,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    msg_buffer_bump: u8,
    target_size: u32,
) -> anchor_lang::Result<Instruction> {
    let msg_buffer_pda = Pubkey::create_program_address(
        &[
            cpi_caller_auth.as_ref(),
            b"message".as_ref(),
            pyth_price_acct.as_ref(),
            &[msg_buffer_bump],
        ],
        &::message_buffer::id(),
    )
    .unwrap();


    let resize_ix_disc = sighash("global", "resize_buffer");

    let resize_ix = Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(
            resize_ix_disc,
            cpi_caller_auth,
            pyth_price_acct,
            msg_buffer_bump,
            target_size,
        ),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new(admin, true),
            AccountMeta::new_readonly(System::id(), false),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    );
    Ok(resize_ix)
}

pub async fn send_resize_msg_buffer(
    banks_client: &mut BanksClient,
    admin: &Keypair,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    msg_buffer_bump: u8,
    target_size: u32,
) -> anchor_lang::Result<()> {
    let resize_ix = resize_msg_buffer_ix(
        admin.pubkey(),
        whitelist,
        cpi_caller_auth,
        pyth_price_acct,
        msg_buffer_bump,
        target_size,
    )
    .await
    .unwrap();

    send_transaction(banks_client, &[resize_ix], admin.pubkey(), vec![admin])
        .await
        .unwrap();
    Ok(())
}

pub async fn delete_msg_buffer_ix(
    admin: Pubkey,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    msg_buffer_bump: u8,
) -> anchor_lang::Result<Instruction> {
    let msg_buffer_pda = Pubkey::create_program_address(
        &[
            cpi_caller_auth.as_ref(),
            b"message".as_ref(),
            pyth_price_acct.as_ref(),
            &[msg_buffer_bump],
        ],
        &::message_buffer::id(),
    )
    .unwrap();


    let delete_ix_disc = sighash("global", "delete_buffer");

    let delete_ix = Instruction::new_with_borsh(
        ::message_buffer::id(),
        &(
            delete_ix_disc,
            cpi_caller_auth,
            pyth_price_acct,
            msg_buffer_bump,
        ),
        vec![
            AccountMeta::new_readonly(whitelist, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(msg_buffer_pda, false),
        ],
    );
    Ok(delete_ix)
}

pub async fn send_delete_msg_buffer(
    banks_client: &mut BanksClient,
    admin: &Keypair,
    whitelist: Pubkey,
    cpi_caller_auth: Pubkey,
    pyth_price_acct: Pubkey,
    msg_buffer_bump: u8,
) -> anchor_lang::Result<()> {
    let delete_ix = delete_msg_buffer_ix(
        admin.pubkey(),
        whitelist,
        cpi_caller_auth,
        pyth_price_acct,
        msg_buffer_bump,
    )
    .await
    .unwrap();

    send_transaction(banks_client, &[delete_ix], admin.pubkey(), vec![admin])
        .await
        .unwrap();
    Ok(())
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
) -> Result<Instruction> {
    let add_price_disc = sighash("global", "add_price");

    let add_price_ix = Instruction::new_with_borsh(
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
    );
    Ok(add_price_ix)
}

pub async fn send_add_price_ix(
    banks_client: &mut BanksClient,
    id: u64,
    price: u64,
    price_expo: u64,
    ema: u64,
    ema_expo: u64,
    payer: &Keypair,
    whitelist: Pubkey,
    cpi_auth: Pubkey,
    pyth_price_account: Pubkey,
    msg_buffer_pda: Pubkey,
) -> Result<()> {
    let add_price_ix = add_price_ix(
        id,
        price,
        price_expo,
        ema,
        ema_expo,
        pyth_price_account,
        payer.pubkey(),
        whitelist,
        cpi_auth,
        msg_buffer_pda,
    )?;

    send_transaction(banks_client, &[add_price_ix], payer.pubkey(), vec![payer])
        .await
        .unwrap();

    // Ok((msg_buffer_pda, msg_buffer_bump))
    Ok(())
}


pub async fn send_transaction(
    banks_client: &mut BanksClient,
    instructions: &[Instruction],
    payer: Pubkey,
    signers: Vec<&Keypair>,
) -> anchor_lang::Result<()> {
    let recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();

    let transaction =
        Transaction::new_signed_with_payer(instructions, Some(&payer), &signers, recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();
    Ok(())
}


pub async fn fetch_whitelist(
    banks_client: &mut BanksClient,
    whitelist: &Pubkey,
) -> (u8, Pubkey, u32, Vec<Pubkey>) {
    let whitelist_account = banks_client.get_account(*whitelist).await.unwrap();
    assert!(whitelist_account.is_some());
    let whitelist_account = whitelist_account.unwrap();
    let account_data = whitelist_account.data();

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
    (
        whitelist_acct_bump,
        admin_pubkey,
        allowed_programs_len,
        allowed_programs,
    )
}

type Bump = u8;
type Version = u8;
type HeaderLen = u16;
type EndOffsets = [u16; 255];

pub async fn fetch_msg_buffer_account_data(
    banks_client: &mut BanksClient,
    msg_buffer: &Pubkey,
) -> Vec<u8> {
    let msg_buffer_account = banks_client.get_account(*msg_buffer).await.unwrap();
    assert!(msg_buffer_account.is_some());
    let msg_buffer_account = msg_buffer_account.unwrap();
    msg_buffer_account.data
}

pub async fn parse_msg_buffer_header(
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

//price::FullPriceMessage & price::CompactPriceMessage
type PriceMsgId = u64;
type PriceMsgPrice = u64;
type PriceMsgPriceExpo = u64;
type PriceMsgEma = u64;
type PriceMsgEmaExpo = u64;


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


pub fn get_mock_pyth_price_account(id: u64) -> Pubkey {
    let (mock_pyth_price_acct, _) = Pubkey::find_program_address(
        &[b"pyth".as_ref(), b"price".as_ref(), &id.to_le_bytes()],
        &::mock_cpi_caller::id(),
    );
    mock_pyth_price_acct
}

pub fn get_mock_cpi_auth() -> Pubkey {
    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );
    mock_cpi_caller_auth
}

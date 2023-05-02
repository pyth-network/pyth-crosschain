#![cfg(feature = "test-bpf")]

use {
    crate::program_test::*,
    solana_program_test::tokio,
    solana_sdk::{
        pubkey::Pubkey,
        signature::{
            Keypair,
            Signer,
        },
    },
};

pub mod program_test;

#[tokio::test]
async fn test_msg_buffer_setup() {
    let pt_ctxt = &mut setup_program_test(false).await;

    // Initialize whitelist

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, whitelist_bump) =
        send_initialize_whitelist(banks_client, payer.pubkey(), payer)
            .await
            .unwrap();

    let (whitelist_acct_bump, admin_pubkey, allowed_programs_len, allowed_programs) =
        fetch_whitelist(banks_client, &whitelist_pda).await;

    assert_eq!(whitelist_bump, whitelist_acct_bump);
    assert_eq!(payer.pubkey(), admin_pubkey);

    assert_eq!(0, allowed_programs_len);
    assert_eq!(allowed_programs, vec![]);

    // Add MockCpiProgram auth pda to allowed programs
    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();

    let (_, _, allowed_programs_len, updated_allowed_programs) =
        fetch_whitelist(banks_client, &whitelist_pda).await;

    assert_eq!(1, allowed_programs_len);
    assert_eq!(allowed_programs, updated_allowed_programs);
}

#[tokio::test]
async fn test_create_msg_buffer() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let space = 1024;
    let (msg_buffer_pda, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        space,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), space as usize);

    let (bump, _version, _header_len, end_offsets) =
        parse_msg_buffer_header(&msg_buffer_account_data).await;

    assert_eq!(bump, msg_buffer_bump);
    assert_eq!(end_offsets, [0u16; 255]);
}

#[tokio::test]
#[should_panic]
async fn fail_create_msg_buffer_with_invalid_admin() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let space = 1024;
    let invalid_admin = Keypair::new();
    send_create_msg_buffer(
        banks_client,
        &invalid_admin,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        space,
    )
    .await
    .unwrap();
}

#[tokio::test]
#[should_panic]
async fn fail_create_msg_buffer_with_invalid_size() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let space = 1;
    send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        space,
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn test_resize_buffer() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let target_size = 1024;
    let (msg_buffer_pda, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        target_size,
    )
    .await
    .unwrap();

    // increase buffer size
    let mut new_target_size = target_size + 10240;
    send_resize_msg_buffer(
        banks_client,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), new_target_size as usize);

    // decrease buffer size to less than original
    new_target_size -= 10240 + 100;
    send_resize_msg_buffer(
        banks_client,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), new_target_size as usize);
}

#[tokio::test]
async fn test_multiple_resize_buffer_ixs() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let target_size = 1024;
    let (msg_buffer_pda, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        target_size,
    )
    .await
    .unwrap();

    // increase buffer size
    let mut new_target_size = target_size + 10240;
    let admin = payer;
    let resize_ix_1 = resize_msg_buffer_ix(
        admin.pubkey(),
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();

    new_target_size += 10240;

    let resize_ix_2 = resize_msg_buffer_ix(
        admin.pubkey(),
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();

    send_transaction(
        banks_client,
        &[resize_ix_1, resize_ix_2],
        payer.pubkey(),
        vec![admin, payer],
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), new_target_size as usize);
}

#[tokio::test]
#[should_panic]
async fn fail_resize_buffer_invalid_increase() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let target_size = 1024;
    let (msg_buffer_pda, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        target_size,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;
    assert_eq!(msg_buffer_account_data.len(), target_size as usize);

    // max increase is +10240
    let new_target_size = target_size + 10240 + 100;
    send_resize_msg_buffer(
        banks_client,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();
}

#[tokio::test]
#[should_panic]
async fn fail_resize_buffer_invalid_decrease() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let target_size = 1024;
    let (_, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        target_size,
    )
    .await
    .unwrap();

    // decrease buffer size to invalid size
    let new_target_size = 1;
    send_resize_msg_buffer(
        banks_client,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
        new_target_size,
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn test_put_all() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let (mock_cpi_caller_auth, _) = Pubkey::find_program_address(
        &[b"upd_price_write".as_ref(), ::message_buffer::id().as_ref()],
        &::mock_cpi_caller::id(),
    );

    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();
    let pyth_price_acct_id = 0u64;
    let mock_pyth_price_acct = get_mock_pyth_price_account(pyth_price_acct_id);
    let space = 1024;
    let (msg_buffer_pda, msg_buffer_bump) = send_create_msg_buffer(
        banks_client,
        payer,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        space,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), space as usize);

    let (bump, _version, _header_len, end_offsets) =
        parse_msg_buffer_header(&msg_buffer_account_data).await;

    assert_eq!(bump, msg_buffer_bump);
    assert_eq!(end_offsets, [0u16; 255]);

    let (id, price, price_expo, ema, ema_expo) = (pyth_price_acct_id, 2u64, 3u64, 4u64, 5u64);
    send_add_price_ix(
        banks_client,
        id,
        price,
        price_expo,
        ema,
        ema_expo,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_pda,
    )
    .await
    .unwrap();

    let msg_buffer_account_data = fetch_msg_buffer_account(banks_client, &msg_buffer_pda).await;

    assert_eq!(msg_buffer_account_data.len(), space as usize);

    let (bump, _version, header_len, end_offsets) =
        parse_msg_buffer_header(&msg_buffer_account_data).await;

    assert_eq!(bump, msg_buffer_bump);
    // size_of(price::MessageHeader) + FullPriceMessage::SIZE
    let msg_size_0 = 7 + 40;
    // size_of(price::MessageHeader) + CompactPriceMessage::SIZE
    let msg_size_1 = 7 + 24;
    assert_eq!(&end_offsets[0..2], &[msg_size_0, msg_size_0 + msg_size_1]);

    assert_eq!(&end_offsets[2..], &[0u16; 253]);

    let msgs = extract_msg_buffer_messages(header_len, end_offsets, &msg_buffer_account_data);

    validate_price_msgs(id, price, price_expo, ema, ema_expo, &msgs).unwrap();
}

#[tokio::test]
#[should_panic]
async fn fail_put_all_invalid_auth() {
    panic!()
}

#[tokio::test]
async fn test_resize_initialized_buffer() {
}

#[tokio::test]
async fn test_delete_buffer() {
}

#[tokio::test]
#[should_panic]
async fn fail_delete_buffer_invalid_admin() {
    panic!()
}

#[tokio::test]
#[should_panic]
async fn fail_delete_buffer_invalid_account() {
    panic!()
}

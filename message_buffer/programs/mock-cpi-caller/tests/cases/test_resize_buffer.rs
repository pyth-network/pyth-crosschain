use super::*;

#[tokio::test]
async fn test_resize_buffer() {
    let pt_ctxt = &mut setup_program_test(false).await;

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, _) = send_initialize_whitelist(banks_client, payer.pubkey(), payer)
        .await
        .unwrap();

    let mock_cpi_caller_auth = get_mock_cpi_auth();


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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;

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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;

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

    let mock_cpi_caller_auth = get_mock_cpi_auth();


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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;

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

    let mock_cpi_caller_auth = get_mock_cpi_auth();

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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;
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

    let mock_cpi_caller_auth = get_mock_cpi_auth();


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
async fn test_resize_initialized_buffer() {
}

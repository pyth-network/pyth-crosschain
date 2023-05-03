use super::*;

#[tokio::test]
async fn test_create_msg_buffer() {
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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;

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

    let mock_cpi_caller_auth = get_mock_cpi_auth();


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

    let mock_cpi_caller_auth = get_mock_cpi_auth();


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

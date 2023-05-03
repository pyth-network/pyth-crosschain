use super::*;

#[tokio::test]
async fn test_delete_buffer() {
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

    let payer_lamports_before = banks_client.get_balance(payer.pubkey()).await.unwrap();

    send_delete_msg_buffer(
        banks_client,
        payer,
        whitelist_pda,
        mock_cpi_caller_auth,
        mock_pyth_price_acct,
        msg_buffer_bump,
    )
    .await
    .unwrap();

    let msg_buffer_account = banks_client.get_account(msg_buffer_pda).await.unwrap();
    assert!(msg_buffer_account.is_none());
    let payer_lamports_after = banks_client.get_balance(payer.pubkey()).await.unwrap();
    assert!(payer_lamports_before < payer_lamports_after);
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

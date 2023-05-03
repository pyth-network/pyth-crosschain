use super::*;

#[tokio::test]
async fn test_put_all() {
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

    let msg_buffer_account_data =
        fetch_msg_buffer_account_data(banks_client, &msg_buffer_pda).await;

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

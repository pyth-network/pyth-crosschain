use super::*;

#[tokio::test]
async fn test_put_all() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let payer = context.payer.pubkey();

    let whitelist = context.whitelist();
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let (msg_buffer_pda, msg_buffer_bump) = MessageBufferTestContext::default_msg_buffer();

    let add_price_params = MessageBufferTestContext::DEFAULT_ADD_PRICE_PARAMS;
    context
        .add_price(add_price_params, payer, whitelist, cpi_caller_auth)
        .await
        .unwrap();

    let (id, price, price_expo, ema, ema_expo) = add_price_params;

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    let (bump, _version, header_len, end_offsets) =
        deserialize_msg_buffer_header(&msg_buffer_account_data);

    assert_eq!(bump, msg_buffer_bump);
    // size_of(price::MessageHeader) + FullPriceMessage::SIZE
    let msg_size_0 = 7 + 40;
    assert_eq!(&end_offsets[0], &msg_size_0);

    // size_of(price::MessageHeader) + CompactPriceMessage::SIZE
    let msg_size_1 = 7 + 24;
    assert_eq!(&end_offsets[1], &(msg_size_0 + msg_size_1));

    assert_eq!(&end_offsets[2..], &[0u16; 253]);

    let msgs = extract_msg_buffer_messages(header_len, end_offsets, &msg_buffer_account_data);
    validate_price_msgs(id, price, price_expo, ema, ema_expo, &msgs).unwrap();
}

#[tokio::test]
#[should_panic]
async fn fail_put_all_invalid_auth() {
    panic!()
}

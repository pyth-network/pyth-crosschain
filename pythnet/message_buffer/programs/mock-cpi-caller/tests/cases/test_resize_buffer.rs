use super::*;

#[tokio::test]
async fn test_resize_buffer() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let (msg_buffer_pda, _) = MessageBufferTestContext::default_msg_buffer();

    // increase buffer size
    let mut target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240;
    let target_sizes = vec![target_size];
    context
        .resize_msg_buffer(
            MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
            target_sizes,
        )
        .await
        .unwrap();

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(msg_buffer_account_data.len(), target_size as usize);

    // decrease buffer size to less than original
    target_size -= 10340;
    let target_sizes = vec![target_size];
    context
        .resize_msg_buffer(
            MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
            target_sizes,
        )
        .await
        .unwrap();

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(msg_buffer_account_data.len(), target_size as usize);
}

#[tokio::test]
async fn test_multiple_resize_buffer_ixs_in_same_txn() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let (msg_buffer_pda, _) = MessageBufferTestContext::default_msg_buffer();

    // increase buffer size
    let mut target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240;
    let mut target_sizes = vec![];
    target_sizes.push(target_size);
    target_size += 10240;
    target_sizes.push(target_size);
    context
        .resize_msg_buffer(
            MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
            target_sizes,
        )
        .await
        .unwrap();

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(msg_buffer_account_data.len(), target_size as usize);
}

#[tokio::test]
#[should_panic]
async fn fail_resize_buffer_invalid_increase() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let whitelist = context.whitelist();
    let admin = context.admin();
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let pyth_price_acct = MessageBufferTestContext::default_pyth_price_account();
    let (msg_buffer_pda, msg_buffer_bump) = MessageBufferTestContext::default_msg_buffer();

    // increase buffer size beyond maximum allowed
    let target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240 + 100;

    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
        whitelist,
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;

    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(anchor_lang::error::ErrorCode::AccountReallocExceedsLimit.into())
    );

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(
        msg_buffer_account_data.len(),
        MessageBufferTestContext::DEFAULT_TARGET_SIZE as usize
    );

    let (bump, _version, _header_len, end_offsets) =
        deserialize_msg_buffer_header(&msg_buffer_account_data);

    assert_eq!(bump, msg_buffer_bump);
    assert_eq!(end_offsets, [0u16; 255]);

    // shrink buffer size to less than MessageBuffer::HEADER_LEN
    let target_size = 15;
    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
        whitelist,
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    // a target_size less than the MessageBuffer::HEADER_LEN
    // will result in a `ProgramFailedToComplete` (or AccountDiscriminatorNotFound
    // if target_size < 8) since after the realloc,
    // the AccountLoadder.load/load_mut() calls will fail
    context
        .process_ixs(&[resize_ix], vec![&admin])
        .await
        .unwrap();
}

#[tokio::test]
async fn test_resize_initialized_buffer() {
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

    // increase buffer size should not edit the original data
    let target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240;
    let target_sizes = vec![target_size];
    context
        .resize_msg_buffer(
            MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
            target_sizes,
        )
        .await
        .unwrap();

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
async fn fail_resize_initialized_buffer() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let payer = context.payer.pubkey();
    let admin = context.admin();
    let pyth_price_acct = MessageBufferTestContext::default_pyth_price_account();
    let whitelist = context.whitelist();
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let (msg_buffer_pda, _msg_buffer_bump) = MessageBufferTestContext::default_msg_buffer();

    let add_price_params = MessageBufferTestContext::DEFAULT_ADD_PRICE_PARAMS;
    context
        .add_price(add_price_params, payer, whitelist, cpi_caller_auth)
        .await
        .unwrap();

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    let (_, _version, header_len, end_offsets) =
        deserialize_msg_buffer_header(&msg_buffer_account_data);

    let max_end_offset = end_offsets.iter().max().unwrap();
    let min_size = header_len + max_end_offset;

    // decrease buffer size to less than something that can fit the current messages
    let target_size = (min_size as u32) - 1;

    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
        whitelist,
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;

    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(MessageBufferError::MessageBufferTooSmall.into())
    );

    let target_size = (min_size as u32) + 1;

    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
        whitelist,
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;

    assert!(res.is_ok());
    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(msg_buffer_account_data.len(), target_size as usize);
}

#[tokio::test]
async fn fail_resize_buffer_exceed_max_size() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let whitelist = context.whitelist();
    let admin = context.admin();
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let pyth_price_acct = MessageBufferTestContext::default_pyth_price_account();
    let (msg_buffer_pda, _msg_buffer_bump) = MessageBufferTestContext::default_msg_buffer();

    // increase buffer size beyond maximum allowed
    let mut target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240;
    while target_size < u32::from(u16::MAX) {
        let resize_ix = resize_msg_buffer_ix(
            cpi_caller_auth,
            pyth_price_acct,
            target_size,
            whitelist,
            admin.pubkey(),
            context.payer.pubkey(),
            msg_buffer_pda,
        );

        let res = context.process_ixs(&[resize_ix], vec![&admin]).await;
        assert!(res.is_ok());
        target_size += 10240;
    }

    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        target_size,
        whitelist,
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;
    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(MessageBufferError::TargetSizeExceedsMaxLen.into())
    );
}

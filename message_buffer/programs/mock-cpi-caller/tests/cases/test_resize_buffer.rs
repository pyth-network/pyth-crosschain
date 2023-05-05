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
async fn fail_resize_buffer_invalid_increase() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let whitelist = context.whitelist();
    let admin = context.default_admin();
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let pyth_price_acct = MessageBufferTestContext::default_pyth_price_account();
    let (msg_buffer_pda, msg_buffer_bump) = MessageBufferTestContext::default_msg_buffer();


    // increase buffer size beyond maximum allowed
    let target_size = MessageBufferTestContext::DEFAULT_TARGET_SIZE + 10240 + 100;

    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        msg_buffer_bump,
        target_size,
        whitelist,
        admin.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;

    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(MessageBufferError::TargetSizeDeltaExceeded.into())
    );


    // shrink buffer size to less than minimum allowed
    let target_size = 1;
    let resize_ix = resize_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        msg_buffer_bump,
        target_size,
        whitelist,
        admin.pubkey(),
        msg_buffer_pda,
    );

    let res = context.process_ixs(&[resize_ix], vec![&admin]).await;

    assert!(res.is_err());
    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(MessageBufferError::MessageBufferTooSmall.into())
    );
}

#[tokio::test]
async fn test_resize_initialized_buffer() {
}

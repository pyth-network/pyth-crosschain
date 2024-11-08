use super::*;

#[tokio::test]
async fn test_create_buffer() {
    let mut context =
        MessageBufferTestContext::initialize_with_default_test_allowed_programs(false)
            .await
            .unwrap();

    let space = 1024;

    let (msg_buffer_pda, msg_buffer_bump) = context
        .create_buffer(MessageBufferTestContext::DEFAULT_TEST_PRICE_ID, space)
        .await
        .unwrap();

    let msg_buffer_account_data = context
        .fetch_msg_buffer_account_data(&msg_buffer_pda)
        .await
        .unwrap();

    assert_eq!(msg_buffer_account_data.len(), space as usize);

    let (bump, _version, _header_len, end_offsets) =
        deserialize_msg_buffer_header(&msg_buffer_account_data);

    assert_eq!(bump, msg_buffer_bump);
    assert_eq!(end_offsets, [0u16; 255]);
}

#[tokio::test]
async fn create_buffer_with_invalid_admin_should_fail() {
    let mut context =
        MessageBufferTestContext::initialize_with_default_test_allowed_programs(false)
            .await
            .unwrap();

    let pyth_price_acct = MessageBufferTestContext::get_mock_pyth_price_account(
        MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
    );
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let space = 1024;
    let invalid_admin = Keypair::new();
    let (msg_buffer_pda, _) = find_msg_buffer_pda(cpi_caller_auth, pyth_price_acct);
    let invalid_create_buffer_ix = create_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        space,
        context.whitelist(),
        invalid_admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context
        .process_ixs(&[invalid_create_buffer_ix], vec![&invalid_admin])
        .await;

    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    // violates the whitelist has_one = admin constraint
    assert_eq!(
        err,
        ProgramError::Custom(anchor_lang::error::ErrorCode::ConstraintHasOne.into())
    )
}

#[tokio::test]
async fn create_buffer_with_invalid_size_should_fail() {
    let mut context =
        MessageBufferTestContext::initialize_with_default_test_allowed_programs(false)
            .await
            .unwrap();

    let pyth_price_acct = MessageBufferTestContext::get_mock_pyth_price_account(
        MessageBufferTestContext::DEFAULT_TEST_PRICE_ID,
    );
    let cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let _whitelist = context.whitelist();
    let admin = context.admin();

    let (msg_buffer_pda, _) = find_msg_buffer_pda(cpi_caller_auth, pyth_price_acct);
    let invalid_create_buffer_ix = create_msg_buffer_ix(
        cpi_caller_auth,
        pyth_price_acct,
        1,
        context.whitelist(),
        admin.pubkey(),
        context.payer.pubkey(),
        msg_buffer_pda,
    );

    let res = context
        .process_ixs(&[invalid_create_buffer_ix], vec![&admin])
        .await;

    assert!(res.is_err());

    let err: ProgramError = res.unwrap_err().into();
    assert_eq!(
        err,
        ProgramError::Custom(MessageBufferError::MessageBufferTooSmall.into())
    );
}

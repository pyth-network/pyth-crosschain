use super::*;

#[tokio::test]
async fn test_delete_buffer() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let payer = context.payer.pubkey();
    let (msg_buffer_pda, _) = MessageBufferTestContext::default_msg_buffer();

    let payer_lamports_before = context.get_balance(payer).await;

    context
        .delete_buffer(MessageBufferTestContext::DEFAULT_TEST_PRICE_ID)
        .await
        .unwrap();

    let msg_buffer_account_data = context.fetch_msg_buffer_account_data(&msg_buffer_pda).await;
    assert!(msg_buffer_account_data.is_none());

    let payer_lamports_after = context.get_balance(payer).await;
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

#[tokio::test]
async fn delete_buffer_after_update_allowed_programs() {
    let mut context = MessageBufferTestContext::initialize_with_default_test_buffer(
        false,
        MessageBufferTestContext::DEFAULT_TARGET_SIZE,
    )
    .await
    .unwrap();

    let new_cpi_auth = Pubkey::new_unique();
    let allowed_programs = vec![new_cpi_auth];
    context
        .set_allowed_programs(&allowed_programs)
        .await
        .unwrap();

    let payer = context.payer.pubkey();
    let (msg_buffer_pda, _) = MessageBufferTestContext::default_msg_buffer();

    let payer_lamports_before = context.get_balance(payer).await;

    context
        .delete_buffer(MessageBufferTestContext::DEFAULT_TEST_PRICE_ID)
        .await
        .unwrap();

    let msg_buffer_account_data = context.fetch_msg_buffer_account_data(&msg_buffer_pda).await;
    assert!(msg_buffer_account_data.is_none());

    let payer_lamports_after = context.get_balance(payer).await;
    assert!(payer_lamports_before < payer_lamports_after);
}

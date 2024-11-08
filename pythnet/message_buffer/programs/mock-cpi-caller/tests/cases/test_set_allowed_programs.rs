use super::*;

#[tokio::test]
async fn test_set_allowed_programs() {
    let context = &mut MessageBufferTestContext::initialize_context(false).await;
    let admin = Keypair::new();
    context.initialize(&admin).await.unwrap();

    let mock_cpi_caller_auth = MessageBufferTestContext::get_mock_cpi_auth();
    let allowed_programs = vec![mock_cpi_caller_auth];
    context
        .set_allowed_programs(&allowed_programs)
        .await
        .unwrap();

    let (_, _, allowed_programs_len, updated_allowed_programs) =
        context.fetch_whitelist().await.unwrap();

    assert_eq!(1, allowed_programs_len);
    assert_eq!(allowed_programs, updated_allowed_programs);
}

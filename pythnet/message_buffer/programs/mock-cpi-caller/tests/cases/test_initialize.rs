use super::*;

#[tokio::test]
async fn test_initialize() {
    let context = &mut MessageBufferTestContext::initialize_context(false).await;
    let admin = Keypair::new();
    let (_, whitelist_bump) = context.initialize(&admin).await.unwrap();

    let (whitelist_acct_bump, admin_pubkey, allowed_programs_len, allowed_programs) =
        context.fetch_whitelist().await.unwrap();

    assert_eq!(whitelist_bump, whitelist_acct_bump);
    assert_eq!(admin.pubkey(), admin_pubkey);

    assert_eq!(0, allowed_programs_len);
    assert_eq!(allowed_programs, vec![]);
}

#[tokio::test]
async fn test_initialize_with_payer_as_admin() {
    let context = &mut MessageBufferTestContext::initialize_context(false).await;
    let admin = &context.payer.insecure_clone();
    let (_, whitelist_bump) = context.initialize(admin).await.unwrap();

    let (whitelist_acct_bump, admin_pubkey, allowed_programs_len, allowed_programs) =
        context.fetch_whitelist().await.unwrap();

    assert_eq!(whitelist_bump, whitelist_acct_bump);
    assert_eq!(admin.pubkey(), admin_pubkey);

    assert_eq!(0, allowed_programs_len);
    assert_eq!(allowed_programs, vec![]);
}

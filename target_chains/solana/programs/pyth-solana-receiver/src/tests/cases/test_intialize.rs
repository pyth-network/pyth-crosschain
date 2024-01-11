use crate::tests::setup::start_receiver_test;

#[tokio::test]
async fn test_initialize() {
    let _bench = start_receiver_test().await;
}

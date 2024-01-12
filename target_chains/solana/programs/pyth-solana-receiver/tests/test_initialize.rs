mod common;

use common::setup_pyth_receiver;

#[tokio::test]
async fn test_post_updates() {
    setup_pyth_receiver().await;
    assert!(true)
}

use fuels::{
    prelude::{Address, Provider, WalletUnlocked},
    types::Bits256,
};
use pyth_sdk::{constants::BETA_5_URL, pyth_utils::guardian_set_upgrade_4_vaa};
use pyth_sdk::{
    constants::{
        BTC_USD_PRICE_FEED_ID, DEFAULT_VALID_TIME_PERIOD, ETH_USD_PRICE_FEED_ID,
        USDC_USD_PRICE_FEED_ID,
    },
    pyth_utils::{update_data_bytes, Pyth},
};

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();

    println!("🔮 Testnet Pyth deploy action");

    let provider = Provider::connect(BETA_5_URL).await.unwrap();

    let admin_pk = std::env::var("ADMIN").expect("ADMIN environment variable missing");
    let admin =
        WalletUnlocked::new_from_private_key(admin_pk.parse().unwrap(), Some(provider.clone()));
    println!("Admin address = 0x{}\n", Address::from(admin.address()));

    let pyth = Pyth::deploy(admin).await.unwrap();

    let _ = pyth
        .constructor(DEFAULT_VALID_TIME_PERIOD, guardian_set_upgrade_4_vaa())
        .await
        .unwrap();

    //check GS
    let gsi = pyth.current_guardian_set_index().await.unwrap().value;
    println!("gsi: {:?}", gsi);

    let update_data = update_data_bytes(None).await.unwrap();
    let fee = pyth.update_fee(&update_data).await.unwrap().value;

    //print fee
    println!("fee: {:?}", fee);

    let btc_price_feed = Bits256::from_hex_str(BTC_USD_PRICE_FEED_ID).unwrap();
    let eth_price_feed = Bits256::from_hex_str(ETH_USD_PRICE_FEED_ID).unwrap();
    let usdc_price_feed = Bits256::from_hex_str(USDC_USD_PRICE_FEED_ID).unwrap();

    let _ = pyth.update_price_feeds(fee, &update_data).await.unwrap();

    println!("Pyth address = 0x{:?}\n", pyth.instance.contract_id().hash);
    println!(
        "BTC price {:?}",
        pyth.price(btc_price_feed).await.unwrap().value
    );
    println!(
        "ETH price {:?}",
        pyth.price(eth_price_feed).await.unwrap().value
    );
    println!(
        "USDC price {:?}",
        pyth.price(usdc_price_feed).await.unwrap().value
    );
}

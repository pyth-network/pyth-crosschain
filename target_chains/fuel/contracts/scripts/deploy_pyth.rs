use fuels::{
    prelude::{Address, Provider, WalletUnlocked},
    types::Bits256,
};
use pyth_sdk::{constants::BETA_5_URL, pyth_utils::guardian_set_upgrade_4_addresses};
use pyth_sdk::{
    constants::{
        BTC_USD_PRICE_FEED_ID, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID, ETH_USD_PRICE_FEED_ID,
        USDC_USD_PRICE_FEED_ID,
    },
    pyth_utils::{update_data_bytes, DataSource, Pyth},
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

    let governance_data_source: DataSource = DataSource {
        chain_id: 1,
        emitter_address: Bits256::from_hex_str(
            "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
        )
        .unwrap(),
    };

    let wormhole_governance_data_source: DataSource = DataSource {
        chain_id: 1,
        emitter_address: Bits256([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 4,
        ]),
    };

    let _ = pyth
        .constructor(
            governance_data_source,
            wormhole_governance_data_source,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_4_addresses(),
            4,
            DUMMY_CHAIN_ID,
        )
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

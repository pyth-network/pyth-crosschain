use crate::constants::{
    BTC_USD_PRICE_FEED_ID, DEFAULT_SINGLE_UPDATE_FEE, ETH_USD_PRICE_FEED_ID,
    GUARDIAN_SET_UPGRADE_3_VAA, GUARDIAN_SET_UPGRADE_4_VAA, PYTH_CONTRACT_BINARY_PATH,
    TEST_ACCUMULATOR_UPDATE_DATA, TEST_BATCH_UPDATE_DATA, UNI_USD_PRICE_FEED_ID,
    USDC_USD_PRICE_FEED_ID,
};
use base64::{
    engine::general_purpose,
    prelude::{Engine, BASE64_STANDARD},
};
use fuels::{
    prelude::{abigen, CallParameters, Contract, LoadConfiguration, TxPolicies, WalletUnlocked},
    programs::call_response::FuelCallResponse,
    types::{errors::Error, Address, Bits256, Bytes, Identity},
};
use rand::Rng;
use reqwest;
use serde_json;
use std::path::PathBuf;

abigen!(Contract(
    name = "PythOracleContract",
    abi = "pyth-contract/out/debug/pyth-contract-abi.json"
));

pub struct Pyth {
    pub instance: PythOracleContract<WalletUnlocked>,
    pub wallet: WalletUnlocked,
}

pub async fn update_data_bytes(
    price_feed_ids: Option<Vec<&str>>,
) -> Result<Vec<Bytes>, Box<dyn std::error::Error>> {
    let c = reqwest::Client::new();

    let price_feed_ids = price_feed_ids.unwrap_or_else(|| {
        vec![
            ETH_USD_PRICE_FEED_ID,
            USDC_USD_PRICE_FEED_ID,
            BTC_USD_PRICE_FEED_ID,
            UNI_USD_PRICE_FEED_ID,
        ]
    });

    let mut ids_query_part = String::new();
    for (index, id) in price_feed_ids.iter().enumerate() {
        if index > 0 {
            ids_query_part.push('&');
        }
        ids_query_part.push_str(&format!("ids[]={}", id));
    }

    let req_url = format!(
        "https://hermes.pyth.network/api/latest_vaas?{}",
        ids_query_part
    );
    let body = c.get(&req_url).send().await?.text().await?;
    let response: Vec<&str> = serde_json::from_str(&body)?;

    let bytes_data: Vec<Bytes> = response
        .iter()
        .map(|data| {
            Bytes(
                general_purpose::STANDARD
                    .decode::<&str>(data)
                    .unwrap()
                    .to_owned(),
            )
        })
        .collect();

    Ok(bytes_data)
}

pub fn test_batch_update_data_bytes() -> Vec<Bytes> {
    TEST_BATCH_UPDATE_DATA
        .iter()
        .map(|update| Bytes(hex::decode(update).unwrap()))
        .collect()
}

pub fn test_accumulator_update_data_bytes() -> Vec<Bytes> {
    vec![Bytes(
        BASE64_STANDARD
            .decode(TEST_ACCUMULATOR_UPDATE_DATA)
            .unwrap(),
    )]
}

impl Pyth {
    pub async fn price(&self, price_feed_id: Bits256) -> Result<FuelCallResponse<Price>, Error> {
        self.instance
            .methods()
            .price(price_feed_id)
            .simulate()
            .await
    }

    pub async fn update_price_feeds(
        &self,
        fee: u64,
        update_data: &[Bytes],
    ) -> Result<FuelCallResponse<()>, Error> {
        self.instance
            .methods()
            .update_price_feeds(update_data.to_vec())
            .call_params(CallParameters::default().with_amount(fee))?
            .call()
            .await
    }

    pub async fn update_fee(&self, update_data: &[Bytes]) -> Result<FuelCallResponse<u64>, Error> {
        self.instance
            .methods()
            .update_fee(update_data.to_vec())
            .simulate()
            .await
    }

    pub async fn constructor(
        &self,
        valid_time_period_seconds: u64,
        wormhole_guardian_set_upgrade: Bytes,
    ) -> Result<FuelCallResponse<()>, Error> {
        self.instance
            .methods()
            .constructor(
                default_data_sources(),
                DEFAULT_SINGLE_UPDATE_FEE,
                valid_time_period_seconds,
                wormhole_guardian_set_upgrade,
            )
            .with_tx_policies(TxPolicies::default().with_gas_price(1))
            .call()
            .await
    }

    pub async fn deploy(wallet: WalletUnlocked) -> Result<Self, Error> {
        let mut rng = rand::thread_rng();
        let salt = rng.gen::<[u8; 32]>();
        let configurables = PythOracleContractConfigurables::default()
            .with_DEPLOYER(Identity::Address(Address::from(wallet.address())));
        let config = LoadConfiguration::default().with_configurables(configurables);

        let id = Contract::load_from(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(PYTH_CONTRACT_BINARY_PATH),
            config,
        )?;
        let deployed_contract = id
            .with_salt(salt)
            .deploy(&wallet, TxPolicies::default().with_gas_price(1))
            .await?;

        Ok(Self {
            instance: PythOracleContract::new(deployed_contract, wallet.clone()),
            wallet,
        })
    }

    pub async fn current_guardian_set_index(&self) -> Result<FuelCallResponse<u32>, Error> {
        self.instance
            .methods()
            .current_guardian_set_index()
            .simulate()
            .await
    }
}

pub fn guardian_set_upgrade_3_vaa() -> Bytes {
    Bytes(hex::decode(GUARDIAN_SET_UPGRADE_3_VAA).unwrap())
}
pub fn guardian_set_upgrade_4_vaa() -> Bytes {
    Bytes(hex::decode(GUARDIAN_SET_UPGRADE_4_VAA).unwrap())
}

pub fn default_price_feed_ids() -> Vec<Bits256> {
    vec![
        Bits256(
            hex::decode(ETH_USD_PRICE_FEED_ID)
                .unwrap()
                .try_into()
                .unwrap(),
        ),
        Bits256(
            hex::decode(USDC_USD_PRICE_FEED_ID)
                .unwrap()
                .try_into()
                .unwrap(),
        ),
    ]
}

// data sources from Pyth EVM deployment docs:
// https://github.com/pyth-network/pyth-crosschain/blob/2008da7a451231489d9866d7ceae3799c07e1fb5/contract_manager/src/base.ts#L116
pub fn default_data_sources() -> Vec<DataSource> {
    vec![
        DataSource {
            chain_id: 1,
            emitter_address: Bits256::from_hex_str(
                "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
            )
            .unwrap(),
        },
        DataSource {
            chain_id: 26,
            emitter_address: Bits256::from_hex_str(
                "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
            )
            .unwrap(),
        },
        DataSource {
            chain_id: 26,
            emitter_address: Bits256::from_hex_str(
                "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
            )
            .unwrap(),
        },
        DataSource {
            chain_id: 1,
            emitter_address: Bits256::from_hex_str(
                "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
            )
            .unwrap(),
        },
        DataSource {
            chain_id: 26,
            emitter_address: Bits256::from_hex_str(
                "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
            )
            .unwrap(),
        },
    ]
}

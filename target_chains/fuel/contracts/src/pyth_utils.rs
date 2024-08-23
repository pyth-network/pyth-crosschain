use crate::constants::{
    BTC_USD_PRICE_FEED_ID, DEFAULT_SINGLE_UPDATE_FEE, ETH_USD_PRICE_FEED_ID,
    GUARDIAN_SET_UPGRADE_3_VAA, GUARDIAN_SET_UPGRADE_4_VAA, PYTH_CONTRACT_BINARY_PATH,
    TEST_ACCUMULATOR_UPDATE_DATA, TEST_BATCH_UPDATE_DATA,
    TEST_CORRUPTED_PROOF_ACCUMULATOR_UPDATE_DATA, UNI_USD_PRICE_FEED_ID, USDC_USD_PRICE_FEED_ID,
};
use base64::{engine::general_purpose, prelude::Engine};
use fuels::{
    prelude::{abigen, CallParameters, Contract, LoadConfiguration, TxPolicies, WalletUnlocked},
    programs::{calls::Execution, responses::CallResponse},
    tx::Receipt,
    types::{
        errors::{transaction::Reason, Error},
        Address, Bits256, Bytes, Identity,
    },
};
use rand::Rng;
use reqwest;
use serde_json;
use serde_wormhole::RawMessage;
use std::path::PathBuf;
use wormhole_sdk::Vaa;

abigen!(Contract(
    name = "PythOracleContract",
    abi = "pyth-contract/out/release/pyth-contract-abi.json"
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
    vec![Bytes(hex::decode(TEST_ACCUMULATOR_UPDATE_DATA).unwrap())]
}

pub fn test_corrupted_proof_accumulator_update_data_bytes() -> Vec<Bytes> {
    vec![Bytes(
        hex::decode(TEST_CORRUPTED_PROOF_ACCUMULATOR_UPDATE_DATA).unwrap(),
    )]
}

pub fn create_set_fee_payload(new_fee: u64, exponent: u64) -> Vec<u8> {
    let base = new_fee / 10u64.pow(exponent.try_into().unwrap());
    let base_bytes = base.to_be_bytes();
    let exponent_bytes = exponent.to_be_bytes();
    let mut payload = Vec::new();
    payload.extend_from_slice(&base_bytes);
    payload.extend_from_slice(&exponent_bytes);
    payload
}

pub fn create_set_valid_period_payload(new_valid_period: u64) -> Vec<u8> {
    let valid_period_bytes = new_valid_period.to_be_bytes();
    let mut payload = Vec::new();
    payload.extend_from_slice(&valid_period_bytes);
    payload
}

pub fn create_set_data_sources_payload(data_sources: Vec<DataSource>) -> Vec<u8> {
    let mut payload = Vec::new();
    payload.push(data_sources.len() as u8);
    for data_source in data_sources {
        payload.extend_from_slice(&data_source.chain_id.to_be_bytes());
        payload.extend_from_slice(&data_source.emitter_address.0);
    }
    payload
}

pub fn create_authorize_governance_data_source_transfer_payload(
    claim_vaa: Vaa<Box<RawMessage>>,
) -> Vec<u8> {
    serde_wormhole::to_vec(&claim_vaa).unwrap()
}

pub fn create_request_governance_data_source_transfer_payload(
    governance_data_source_index: u32,
) -> Vec<u8> {
    let index_bytes = governance_data_source_index.to_be_bytes();
    let mut payload = Vec::new();
    payload.extend_from_slice(&index_bytes);
    payload
}

pub fn create_governance_instruction_payload(
    magic: u32,
    module: GovernanceModule,
    action: GovernanceAction,
    target_chain_id: u16,
    payload: Vec<u8>,
) -> Vec<u8> {
    let mut buffer = Vec::new();
    buffer.extend_from_slice(&magic.to_be_bytes());
    let module_number = match module {
        GovernanceModule::Executor => 0,
        GovernanceModule::Target => 1,
        GovernanceModule::EvmExecutor => 2,
        GovernanceModule::StacksTarget => 3,
        GovernanceModule::Invalid => u8::MAX, // Typically 255 for invalid
    };
    buffer.push(module_number);
    let action_number = match action {
        GovernanceAction::UpgradeContract => 0,
        GovernanceAction::AuthorizeGovernanceDataSourceTransfer => 1,
        GovernanceAction::SetDataSources => 2,
        GovernanceAction::SetFee => 3,
        GovernanceAction::SetValidPeriod => 4,
        GovernanceAction::RequestGovernanceDataSourceTransfer => 5,
        GovernanceAction::Invalid => u8::MAX, // Typically 255 for invalid
    };
    buffer.push(action_number);
    buffer.extend_from_slice(&target_chain_id.to_be_bytes());
    buffer.extend_from_slice(&payload);
    buffer
}

impl Pyth {
    pub async fn price(&self, price_feed_id: Bits256) -> Result<CallResponse<Price>, Error> {
        self.instance
            .methods()
            .price(price_feed_id)
            .simulate(Execution::StateReadOnly)
            .await
    }

    pub async fn update_price_feeds(
        &self,
        fee: u64,
        update_data: &[Bytes],
    ) -> Result<CallResponse<()>, Error> {
        self.instance
            .methods()
            .update_price_feeds(update_data.to_vec())
            .call_params(CallParameters::default().with_amount(fee))?
            .call()
            .await
    }

    pub async fn update_fee(&self, update_data: &[Bytes]) -> Result<CallResponse<u64>, Error> {
        self.instance
            .methods()
            .update_fee(update_data.to_vec())
            .simulate(Execution::StateReadOnly)
            .await
    }

    pub async fn constructor(
        &self,
        governance_data_source: DataSource,
        wormhole_governance_data_source: DataSource,
        valid_time_period_seconds: u64,
        wormhole_guardian_set_addresses: Vec<Bits256>,
        wormhole_guardian_set_index: u32,
        chain_id: u16,
    ) -> Result<CallResponse<()>, Error> {
        self.instance
            .methods()
            .constructor(
                default_data_sources(),
                governance_data_source,
                wormhole_governance_data_source,
                DEFAULT_SINGLE_UPDATE_FEE,
                valid_time_period_seconds,
                wormhole_guardian_set_addresses,
                wormhole_guardian_set_index,
                chain_id,
            )
            .with_tx_policies(TxPolicies::default().with_tip(1))
            .call()
            .await
    }

    pub async fn deploy(wallet: WalletUnlocked) -> Result<Self, Error> {
        let mut rng = rand::thread_rng();
        let salt = rng.gen::<[u8; 32]>();
        let configurables = PythOracleContractConfigurables::default()
            .with_DEPLOYER(Identity::Address(Address::from(wallet.address())))?;
        let config = LoadConfiguration::default().with_configurables(configurables);

        let id = Contract::load_from(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(PYTH_CONTRACT_BINARY_PATH),
            config,
        )?;
        let deployed_contract = id
            .with_salt(salt)
            .deploy(&wallet, TxPolicies::default().with_tip(1))
            .await?;

        Ok(Self {
            instance: PythOracleContract::new(deployed_contract, wallet.clone()),
            wallet,
        })
    }

    pub async fn current_guardian_set_index(&self) -> Result<CallResponse<u32>, Error> {
        self.instance
            .methods()
            .current_guardian_set_index()
            .simulate(Execution::StateReadOnly)
            .await
    }
}

pub fn guardian_set_upgrade_3_vaa() -> Bytes {
    Bytes(hex::decode(GUARDIAN_SET_UPGRADE_3_VAA).unwrap())
}
pub fn guardian_set_upgrade_4_vaa() -> Bytes {
    Bytes(hex::decode(GUARDIAN_SET_UPGRADE_4_VAA).unwrap())
}

// Full list of guardian set upgrade 3 addresses can be found here: https://github.com/wormhole-foundation/wormhole-networks/blob/master/mainnetv2/guardianset/v3.prototxt
pub fn guardian_set_upgrade_3_addresses() -> Vec<Bits256> {
    let addresses = vec![
        "58CC3AE5C097b213cE3c81979e1B9f9570746AA5", // Certus One
        "fF6CB952589BDE862c25Ef4392132fb9D4A42157", // Staked
        "114De8460193bdf3A2fCf81f86a09765F4762fD1", // Figment
        "107A0086b32d7A0977926A205131d8731D39cbEB", // ChainodeTech
        "8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2", // Inotel
        "11b39756C042441BE6D8650b69b54EbE715E2343", // HashQuark
        "54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd", // Chainlayer
        "15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20", // xLabs
        "74a3bf913953D695260D88BC1aA25A4eeE363ef0", // Forbole
        "000aC0076727b35FBea2dAc28fEE5cCB0fEA768e", // Staking Fund
        "AF45Ced136b9D9e24903464AE889F5C8a723FC14", // Moonlet Wallet
        "f93124b7c738843CBB89E864c862c38cddCccF95", // P2P
        "D2CC37A4dc036a8D232b48f62cDD4731412f4890", // 01Node
        "DA798F6896A3331F64b48c12D1D57Fd9cbe70811", // MCF
        "71AA1BE1D36CaFE3867910F99C09e347899C19C3", // Everstake
        "8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf", // Chorus One
        "178e21ad2E77AE06711549CFBB1f9c7a9d8096e8", // Syncnode
        "5E1487F35515d02A92753504a8D75471b9f49EdB", // Triton
        "6FbEBc898F403E4773E95feB15E80C9A99c8348d", // Staking Facilities
    ];

    // Convert the addresses to Bits256 by padding the leftmost 12 bytes with zeros. This is done because the original 20-byte key is shorter than the 32-byte b256 type.
    addresses
        .iter()
        .map(|&addr| Bits256::from_hex_str(&format!("{:0>64}", addr)).unwrap())
        .collect()
}

// Full list of guardian set upgrade 4 addresses can be found here: https://github.com/wormhole-foundation/wormhole-networks/blob/master/mainnetv2/guardianset/v4.prototxt
pub fn guardian_set_upgrade_4_addresses() -> Vec<Bits256> {
    let addresses = vec![
        "5893B5A76c3f739645648885bDCcC06cd70a3Cd3", // RockawayX
        "fF6CB952589BDE862c25Ef4392132fb9D4A42157", // Staked
        "114De8460193bdf3A2fCf81f86a09765F4762fD1", // Figment
        "107A0086b32d7A0977926A205131d8731D39cbEB", // ChainodeTech
        "8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2", // Inotel
        "11b39756C042441BE6D8650b69b54EbE715E2343", // HashQuark
        "54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd", // Chainlayer
        "15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20", // xLabs
        "74a3bf913953D695260D88BC1aA25A4eeE363ef0", // Forbole
        "000aC0076727b35FBea2dAc28fEE5cCB0fEA768e", // Staking Fund
        "AF45Ced136b9D9e24903464AE889F5C8a723FC14", // Moonlet Wallet
        "f93124b7c738843CBB89E864c862c38cddCccF95", // P2P
        "D2CC37A4dc036a8D232b48f62cDD4731412f4890", // 01Node
        "DA798F6896A3331F64b48c12D1D57Fd9cbe70811", // MCF
        "71AA1BE1D36CaFE3867910F99C09e347899C19C3", // Everstake
        "8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf", // Chorus One
        "178e21ad2E77AE06711549CFBB1f9c7a9d8096e8", // Syncnode
        "5E1487F35515d02A92753504a8D75471b9f49EdB", // Triton
        "6FbEBc898F403E4773E95feB15E80C9A99c8348d", // Staking Facilities
    ];

    // Convert the addresses to Bits256 by padding the leftmost 12 bytes with zeros. This is done because the original 20-byte key is shorter than the 32-byte b256 type.
    addresses
        .iter()
        .map(|&addr| Bits256::from_hex_str(&format!("{:0>64}", addr)).unwrap())
        .collect()
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

pub fn handle_error(e: Error) -> Error {
    if let Error::Transaction(Reason::Reverted {
        reason: _,
        revert_id: _,
        receipts,
    }) = &e
    {
        for r in receipts {
            match r {
                Receipt::Log { ra, .. } => {
                    println!("{:?}", ra);
                }
                Receipt::LogData { data, .. } => {
                    println!("{:?}", hex::encode(data.clone().unwrap()));
                }
                _ => {}
            }
        }
    }
    e
}

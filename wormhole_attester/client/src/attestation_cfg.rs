use {
    crate::{
        attestation_cfg::SymbolConfig::{
            Key,
            Name,
        },
        P2WProductAccount,
    },
    log::{
        info,
        warn,
    },
    serde::{
        de::Error,
        Deserialize,
        Deserializer,
        Serialize,
        Serializer,
    },
    solana_program::pubkey::Pubkey,
    std::{
        collections::{
            HashMap,
            HashSet,
        },
        str::FromStr,
    },
};

/// Pyth2wormhole config specific to attestation requests
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
pub struct AttestationConfig {
    #[serde(default = "default_min_msg_reuse_interval_ms")]
    pub min_msg_reuse_interval_ms: u64,
    #[serde(default = "default_max_msg_accounts")]
    pub max_msg_accounts:          u64,

    /// How many consecutive attestation failures cause the service to
    /// report as unhealthy.
    #[serde(default = "default_healthcheck_window_size")]
    pub healthcheck_window_size: u64,

    #[serde(default = "default_enable_healthcheck")]
    pub enable_healthcheck: bool,

    /// Optionally, we take a mapping account to add remaining symbols from a Pyth deployments.
    /// These symbols are processed under `default_attestation_conditions`.
    #[serde(
        deserialize_with = "opt_pubkey_string_de",
        serialize_with = "opt_pubkey_string_ser",
        default // Uses Option::default() which is None
    )]
    pub mapping_addr:                   Option<Pubkey>,
    /// The known symbol list will be reloaded based off this
    /// interval, to account for mapping changes. Note: This interval
    /// will only work if the mapping address is defined. Whenever
    /// it's time to look up the mapping, new attestation jobs are
    /// started lazily, only if mapping contents affected the known
    /// symbol list, and before stopping the pre-existing obsolete
    /// jobs to maintain uninterrupted cranking.
    #[serde(default = "default_mapping_reload_interval_mins")]
    pub mapping_reload_interval_mins:   u64,
    #[serde(default = "default_min_rpc_interval_ms")]
    /// Rate-limiting minimum delay between RPC requests in milliseconds
    pub min_rpc_interval_ms:            u64,
    /// Attestation conditions that will be used for any symbols included in the mapping
    /// that aren't explicitly in one of the groups below, and any groups without explicitly
    /// configured attestation conditions.
    pub default_attestation_conditions: AttestationConditions,

    /// Groups of symbols to publish.
    pub symbol_groups: Vec<SymbolGroupConfig>,
}

impl AttestationConfig {
    /// Instantiate the batches of symbols to attest by matching the config against the collection
    /// of on-chain product accounts.
    pub fn instantiate_batches(
        &self,
        product_accounts: &[P2WProductAccount],
        max_batch_size: usize,
    ) -> Vec<SymbolBatch> {
        // Construct mapping from the name of each product account to its corresponding symbols
        let mut name_to_symbols: HashMap<String, Vec<P2WSymbol>> = HashMap::new();
        for product_account in product_accounts {
            for price_account_key in &product_account.price_account_keys {
                if let Some(name) = &product_account.name {
                    let symbol = P2WSymbol {
                        name:         Some(name.clone()),
                        product_addr: product_account.key,
                        price_addr:   *price_account_key,
                    };

                    name_to_symbols
                        .entry(name.clone())
                        .or_default()
                        .push(symbol);
                }
            }
        }

        // Instantiate batches from the configured symbol groups.
        let mut configured_batches: Vec<SymbolBatch> = vec![];
        for group in &self.symbol_groups {
            let group_symbols: Vec<P2WSymbol> = group
                .symbols
                .iter()
                .flat_map(|symbol| match &symbol {
                    Key {
                        name,
                        product,
                        price,
                    } => {
                        vec![P2WSymbol {
                            name:         name.clone(),
                            product_addr: *product,
                            price_addr:   *price,
                        }]
                    }
                    Name { name } => {
                        let maybe_matched_symbols: Option<&Vec<P2WSymbol>> =
                            name_to_symbols.get(name);
                        if let Some(matched_symbols) = maybe_matched_symbols {
                            matched_symbols.clone()
                        } else {
                            // It's slightly unfortunate that this is a warning, but it seems better than crashing.
                            // The data in the mapping account can change while the attester is running and trigger this case,
                            // which means that it is not necessarily a configuration problem.
                            // Note that any named symbols in the config which fail to match will still be included
                            // in the remaining_symbols group below.
                            warn!(
                                "Could not find product account for configured symbol {}",
                                name
                            );
                            vec![]
                        }
                    }
                })
                .collect();

            let group_conditions = group
                .conditions
                .as_ref()
                .unwrap_or(&self.default_attestation_conditions);
            configured_batches.extend(AttestationConfig::partition_into_batches(
                &group.group_name,
                max_batch_size,
                group_conditions,
                group_symbols,
            ))
        }

        // Find any accounts not included in existing batches and group them into a remainder batch
        let existing_price_accounts: HashSet<Pubkey> = configured_batches
            .iter()
            .flat_map(|batch| batch.symbols.iter().map(|symbol| symbol.price_addr))
            .chain(
                configured_batches
                    .iter()
                    .flat_map(|batch| batch.symbols.iter().map(|symbol| symbol.price_addr)),
            )
            .collect();

        let mut remaining_symbols: Vec<P2WSymbol> = vec![];
        for product_account in product_accounts {
            for price_account_key in &product_account.price_account_keys {
                if !existing_price_accounts.contains(price_account_key) {
                    let symbol = P2WSymbol {
                        name:         product_account.name.clone(),
                        product_addr: product_account.key,
                        price_addr:   *price_account_key,
                    };
                    remaining_symbols.push(symbol);
                }
            }
        }
        let remaining_batches = AttestationConfig::partition_into_batches(
            &"mapping".to_owned(),
            max_batch_size,
            &self.default_attestation_conditions,
            remaining_symbols,
        );

        let all_batches = configured_batches
            .into_iter()
            .chain(remaining_batches.into_iter())
            .collect::<Vec<SymbolBatch>>();

        for batch in &all_batches {
            info!(
                "Batch {:?}, {} symbols",
                batch.group_name,
                batch.symbols.len(),
            );
        }

        all_batches
    }

    /// Partition symbols into a collection of batches, each of which contains no more than
    /// `max_batch_size` symbols.
    fn partition_into_batches(
        batch_name: &String,
        max_batch_size: usize,
        conditions: &AttestationConditions,
        symbols: Vec<P2WSymbol>,
    ) -> Vec<SymbolBatch> {
        symbols
            .as_slice()
            .chunks(max_batch_size)
            .map(move |batch_symbols| SymbolBatch {
                group_name: batch_name.to_owned(),
                symbols:    batch_symbols.to_vec(),
                conditions: conditions.clone(),
            })
            .collect()
    }
}

#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
pub struct SymbolGroupConfig {
    pub group_name: String,
    /// Attestation conditions applied to all symbols in this group
    /// If not provided, use the default attestation conditions from `AttestationConfig`.
    pub conditions: Option<AttestationConditions>,

    /// The symbols to publish in this group.
    pub symbols: Vec<SymbolConfig>,
}

/// Config entry for a symbol to attest.
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SymbolConfig {
    /// A symbol specified by its product name.
    Name {
        /// The name of the symbol. This name is matched against the "symbol" field in the product
        /// account metadata. If multiple price accounts have this name (either because 2 product
        /// accounts have the same symbol or a single product account has multiple price accounts),
        /// it matches *all* of them and puts them into this group.
        name: String,
    },
    /// A symbol specified by its product and price account keys.
    Key {
        /// Optional human-readable name for the symbol (for logging purposes).
        /// This field does not need to match the on-chain data for the product.
        name: Option<String>,

        #[serde(
            deserialize_with = "pubkey_string_de",
            serialize_with = "pubkey_string_ser"
        )]
        product: Pubkey,
        #[serde(
            deserialize_with = "pubkey_string_de",
            serialize_with = "pubkey_string_ser"
        )]
        price:   Pubkey,
    },
}

impl ToString for SymbolConfig {
    fn to_string(&self) -> String {
        match &self {
            Name { name } => name.clone(),
            Key {
                name: Some(name),
                product: _,
                price: _,
            } => name.clone(),
            Key {
                name: None,
                product,
                price: _,
            } => {
                format!("Unnamed product {product}")
            }
        }
    }
}

/// A batch of symbols that's ready to be attested. Includes all necessary information
/// (such as price/product account keys).
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
pub struct SymbolBatch {
    pub group_name: String,
    /// Attestation conditions applied to all symbols in this group
    pub conditions: AttestationConditions,
    pub symbols:    Vec<P2WSymbol>,
}

pub const fn default_max_msg_accounts() -> u64 {
    1_000_000
}

pub const fn default_min_msg_reuse_interval_ms() -> u64 {
    10_000 // 10s
}

pub const fn default_healthcheck_window_size() -> u64 {
    100
}

pub const fn default_enable_healthcheck() -> bool {
    true
}

pub const fn default_mapping_reload_interval_mins() -> u64 {
    15
}

pub const fn default_min_rpc_interval_ms() -> u64 {
    150
}

pub const fn default_min_interval_secs() -> u64 {
    60
}

pub const fn default_max_batch_jobs() -> usize {
    20
}

/// Spontaneous attestation triggers. Attestation is triggered if any
/// of the active conditions is met. Option<> fields can be
/// de-activated with None. All conditions are inactive by default,
/// except for the non-Option ones.
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
pub struct AttestationConditions {
    /// Baseline, unconditional attestation interval. Attestation is triggered if the specified interval elapsed since last attestation.
    #[serde(default = "default_min_interval_secs")]
    pub min_interval_secs: u64,

    /// Limit concurrent attestation attempts per batch. This setting
    /// should act only as a failsafe cap on resource consumption and is
    /// best set well above the expected average number of jobs.
    #[serde(default = "default_max_batch_jobs")]
    pub max_batch_jobs: usize,

    /// Trigger attestation if price changes by the specified
    /// percentage, expressed in integer basis points (1bps = 0.01%)
    #[serde(default)]
    pub price_changed_bps: Option<u64>,

    /// Trigger attestation if publish_time advances at least the
    /// specified amount.
    #[serde(default)]
    pub publish_time_min_delta_secs: Option<u64>,
}

impl AttestationConditions {
    /// Used by should_resend() to check if it needs to make the expensive RPC request
    pub fn need_onchain_lookup(&self) -> bool {
        // Bug trap for new fields that also need to be included in
        // the returned expression
        let AttestationConditions {
            min_interval_secs: _min_interval_secs,
            max_batch_jobs: _max_batch_jobs,
            price_changed_bps,
            publish_time_min_delta_secs,
        } = self;

        price_changed_bps.is_some() || publish_time_min_delta_secs.is_some()
    }
}

impl Default for AttestationConditions {
    fn default() -> Self {
        Self {
            min_interval_secs:           default_min_interval_secs(),
            max_batch_jobs:              default_max_batch_jobs(),
            price_changed_bps:           None,
            publish_time_min_delta_secs: None,
        }
    }
}

#[derive(Clone, Default, Debug, Hash, Deserialize, Serialize, PartialEq, Eq)]
pub struct P2WSymbol {
    /// User-defined human-readable name
    pub name: Option<String>,

    #[serde(
        deserialize_with = "pubkey_string_de",
        serialize_with = "pubkey_string_ser"
    )]
    pub product_addr: Pubkey,
    #[serde(
        deserialize_with = "pubkey_string_de",
        serialize_with = "pubkey_string_ser"
    )]
    pub price_addr:   Pubkey,
}

impl ToString for P2WSymbol {
    fn to_string(&self) -> String {
        self.name
            .clone()
            .unwrap_or(format!("Unnamed product {}", self.product_addr))
    }
}

// Helper methods for strinigified SOL addresses

fn pubkey_string_ser<S>(k: &Pubkey, ser: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    ser.serialize_str(&k.to_string())
}

fn pubkey_string_de<'de, D>(de: D) -> Result<Pubkey, D::Error>
where
    D: Deserializer<'de>,
{
    let pubkey_string = String::deserialize(de)?;
    let pubkey = Pubkey::from_str(&pubkey_string).map_err(D::Error::custom)?;
    Ok(pubkey)
}

fn opt_pubkey_string_ser<S>(k_opt: &Option<Pubkey>, ser: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let k_str_opt = (*k_opt).map(|k| k.to_string());

    Option::<String>::serialize(&k_str_opt, ser)
}

fn opt_pubkey_string_de<'de, D>(de: D) -> Result<Option<Pubkey>, D::Error>
where
    D: Deserializer<'de>,
{
    match Option::<String>::deserialize(de)? {
        Some(k) => Ok(Some(Pubkey::from_str(&k).map_err(D::Error::custom)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::attestation_cfg::SymbolConfig::{
            Key,
            Name,
        },
        solitaire::ErrBox,
    };

    #[test]
    fn test_sanity() -> Result<(), ErrBox> {
        let fastbois = SymbolGroupConfig {
            group_name: "fast bois".to_owned(),
            conditions: Some(AttestationConditions {
                min_interval_secs: 5,
                ..Default::default()
            }),
            symbols:    vec![
                Name {
                    name: "ETHUSD".to_owned(),
                },
                Key {
                    name:    Some("BTCUSD".to_owned()),
                    product: Pubkey::new_unique(),
                    price:   Pubkey::new_unique(),
                },
            ],
        };

        let slowbois = SymbolGroupConfig {
            group_name: "slow bois".to_owned(),
            conditions: Some(AttestationConditions {
                min_interval_secs: 200,
                ..Default::default()
            }),
            symbols:    vec![
                Name {
                    name: "CNYAUD".to_owned(),
                },
                Key {
                    name:    None,
                    product: Pubkey::new_unique(),
                    price:   Pubkey::new_unique(),
                },
            ],
        };

        let cfg = AttestationConfig {
            min_msg_reuse_interval_ms:      1000,
            max_msg_accounts:               100_000,
            enable_healthcheck:             true,
            healthcheck_window_size:        100,
            min_rpc_interval_ms:            2123,
            mapping_addr:                   None,
            mapping_reload_interval_mins:   42,
            default_attestation_conditions: AttestationConditions::default(),
            symbol_groups:                  vec![fastbois, slowbois],
        };

        let serialized = serde_yaml::to_string(&cfg)?;

        let deserialized: AttestationConfig = serde_yaml::from_str(&serialized)?;

        assert_eq!(cfg, deserialized);

        Ok(())
    }

    #[test]
    fn test_instantiate_batches() -> Result<(), ErrBox> {
        let btc_product_key = Pubkey::new_unique();
        let btc_price_key = Pubkey::new_unique();

        let eth_product_key = Pubkey::new_unique();
        let eth_price_key_1 = Pubkey::new_unique();
        let eth_price_key_2 = Pubkey::new_unique();

        let unk_product_key = Pubkey::new_unique();
        let unk_price_key = Pubkey::new_unique();

        let eth_dup_product_key = Pubkey::new_unique();
        let eth_dup_price_key = Pubkey::new_unique();

        let attestation_conditions_1 = AttestationConditions {
            min_interval_secs: 5,
            ..Default::default()
        };

        let products = vec![
            P2WProductAccount {
                name:               Some("ETHUSD".to_owned()),
                key:                eth_product_key,
                price_account_keys: vec![eth_price_key_1, eth_price_key_2],
            },
            P2WProductAccount {
                name:               None,
                key:                unk_product_key,
                price_account_keys: vec![unk_price_key],
            },
        ];

        let group1 = SymbolGroupConfig {
            group_name: "group 1".to_owned(),
            conditions: Some(attestation_conditions_1.clone()),
            symbols:    vec![
                Key {
                    name:    Some("BTCUSD".to_owned()),
                    price:   btc_price_key,
                    product: btc_product_key,
                },
                Name {
                    name: "ETHUSD".to_owned(),
                },
            ],
        };

        let group2 = SymbolGroupConfig {
            group_name: "group 2".to_owned(),
            conditions: None,
            symbols:    vec![Key {
                name:    Some("ETHUSD".to_owned()),
                price:   eth_dup_price_key,
                product: eth_dup_product_key,
            }],
        };

        let default_attestation_conditions = AttestationConditions {
            min_interval_secs: 1,
            ..Default::default()
        };

        let cfg = AttestationConfig {
            min_msg_reuse_interval_ms:      1000,
            max_msg_accounts:               100_000,
            healthcheck_window_size:        100,
            enable_healthcheck:             true,
            min_rpc_interval_ms:            2123,
            mapping_addr:                   None,
            mapping_reload_interval_mins:   42,
            default_attestation_conditions: default_attestation_conditions.clone(),
            symbol_groups:                  vec![group1, group2],
        };

        let batches = cfg.instantiate_batches(&products, 2);

        assert_eq!(
            batches,
            vec![
                SymbolBatch {
                    group_name: "group 1".to_owned(),
                    conditions: attestation_conditions_1.clone(),
                    symbols:    vec![
                        P2WSymbol {
                            name:         Some("BTCUSD".to_owned()),
                            product_addr: btc_product_key,
                            price_addr:   btc_price_key,
                        },
                        P2WSymbol {
                            name:         Some("ETHUSD".to_owned()),
                            product_addr: eth_product_key,
                            price_addr:   eth_price_key_1,
                        }
                    ],
                },
                SymbolBatch {
                    group_name: "group 1".to_owned(),
                    conditions: attestation_conditions_1,
                    symbols:    vec![P2WSymbol {
                        name:         Some("ETHUSD".to_owned()),
                        product_addr: eth_product_key,
                        price_addr:   eth_price_key_2,
                    }],
                },
                SymbolBatch {
                    group_name: "group 2".to_owned(),
                    conditions: default_attestation_conditions.clone(),
                    symbols:    vec![P2WSymbol {
                        name:         Some("ETHUSD".to_owned()),
                        product_addr: eth_dup_product_key,
                        price_addr:   eth_dup_price_key,
                    }],
                },
                SymbolBatch {
                    group_name: "mapping".to_owned(),
                    conditions: default_attestation_conditions,
                    symbols:    vec![P2WSymbol {
                        name:         None,
                        product_addr: unk_product_key,
                        price_addr:   unk_price_key,
                    }],
                }
            ]
        );

        Ok(())
    }
}

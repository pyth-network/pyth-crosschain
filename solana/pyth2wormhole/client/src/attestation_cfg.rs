use {
    crate::BatchState,
    log::info,
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
        iter,
        str::FromStr,
    },
};

/// Pyth2wormhole config specific to attestation requests
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
pub struct AttestationConfig {
    #[serde(default = "default_min_msg_reuse_interval_ms")]
    pub min_msg_reuse_interval_ms:    u64,
    #[serde(default = "default_max_msg_accounts")]
    pub max_msg_accounts:             u64,
    /// Optionally, we take a mapping account to add remaining symbols from a Pyth deployments. These symbols are processed under attestation conditions for the `default` symbol group.
    #[serde(
        deserialize_with = "opt_pubkey_string_de",
        serialize_with = "opt_pubkey_string_ser",
        default // Uses Option::default() which is None
    )]
    pub mapping_addr:                 Option<Pubkey>,
    /// The known symbol list will be reloaded based off this
    /// interval, to account for mapping changes. Note: This interval
    /// will only work if the mapping address is defined. Whenever
    /// it's time to look up the mapping, new attestation jobs are
    /// started lazily, only if mapping contents affected the known
    /// symbol list, and before stopping the pre-existing obsolete
    /// jobs to maintain uninterrupted cranking.
    #[serde(default = "default_mapping_reload_interval_mins")]
    pub mapping_reload_interval_mins: u64,
    #[serde(default = "default_min_rpc_interval_ms")]
    /// Rate-limiting minimum delay between RPC requests in milliseconds"
    pub min_rpc_interval_ms:          u64,
    pub symbol_groups:                Vec<SymbolGroup>,
}

impl AttestationConfig {
    /// Merges new symbols into the attestation config. Pre-existing
    /// new symbols are ignored. The new_group_name group can already
    /// exist - symbols will be appended to `symbols` field.
    pub fn add_symbols(
        &mut self,
        mut new_symbols: HashMap<Pubkey, HashSet<Pubkey>>,
        group_name: String, // Which group is extended by the new symbols
    ) {
        // Remove pre-existing symbols from the new symbols collection
        for existing_group in &self.symbol_groups {
            for existing_sym in &existing_group.symbols {
                // Check if new symbols mention this product
                if let Some(prices) = new_symbols.get_mut(&existing_sym.product_addr) {
                    // Prune the price if exists
                    prices.remove(&existing_sym.price_addr);
                }
            }
        }

        // Turn the pruned symbols into P2WSymbol structs
        let mut new_symbols_vec = new_symbols
            .drain() // Makes us own the elements and lets us move them
            .map(|(prod, prices)| iter::zip(iter::repeat(prod), prices)) // Convert to iterator over flat (prod, price) tuples
            .flatten() // Flatten the tuple iterators
            .map(|(prod, price)| P2WSymbol {
                name:         None,
                product_addr: prod,
                price_addr:   price,
            })
            .collect::<Vec<P2WSymbol>>();

        // Find and extend OR create the group of specified name
        match self
            .symbol_groups
            .iter_mut()
            .find(|g| g.group_name == group_name) // Advances the iterator and returns Some(item) on first hit
        {
            Some(existing_group) => existing_group.symbols.append(&mut new_symbols_vec),
            None if new_symbols_vec.len() != 0 => {
                // Group does not exist, assume defaults
                let new_group = SymbolGroup {
                    group_name,
                    conditions: Default::default(),
                    symbols: new_symbols_vec,
                };

                self.symbol_groups.push(new_group);
            }
            None => {}
        }
    }

    pub fn as_batches(&self, max_batch_size: usize) -> Vec<BatchState> {
        self.symbol_groups
            .iter()
            .map(move |g| {
                let conditions4closure = g.conditions.clone();
                let name4closure = g.group_name.clone();

                info!("Group {:?}, {} symbols", g.group_name, g.symbols.len(),);

                // Divide group into batches
                g.symbols
                    .as_slice()
                    .chunks(max_batch_size.clone())
                    .map(move |symbols| {
                        BatchState::new(name4closure.clone(), symbols, conditions4closure.clone())
                    })
            })
            .flatten()
            .collect()
    }
}

#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
pub struct SymbolGroup {
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
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
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

/// Config entry for a Pyth product + price pair
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
    let k_str_opt = k_opt.clone().map(|k| k.to_string());

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
        solitaire::ErrBox,
    };

    #[test]
    fn test_sanity() -> Result<(), ErrBox> {
        let fastbois = SymbolGroup {
            group_name: "fast bois".to_owned(),
            conditions: AttestationConditions {
                min_interval_secs: 5,
                ..Default::default()
            },
            symbols:    vec![
                P2WSymbol {
                    name: Some("ETHUSD".to_owned()),
                    ..Default::default()
                },
                P2WSymbol {
                    name: Some("BTCUSD".to_owned()),
                    ..Default::default()
                },
            ],
        };

        let slowbois = SymbolGroup {
            group_name: "slow bois".to_owned(),
            conditions: AttestationConditions {
                min_interval_secs: 200,
                ..Default::default()
            },
            symbols:    vec![
                P2WSymbol {
                    name: Some("CNYAUD".to_owned()),
                    ..Default::default()
                },
                P2WSymbol {
                    name: Some("INRPLN".to_owned()),
                    ..Default::default()
                },
            ],
        };

        let cfg = AttestationConfig {
            min_msg_reuse_interval_ms:    1000,
            max_msg_accounts:             100_000,
            min_rpc_interval_ms:          2123,
            mapping_addr:                 None,
            mapping_reload_interval_mins: 42,
            symbol_groups:                vec![fastbois, slowbois],
        };

        let serialized = serde_yaml::to_string(&cfg)?;

        let deserialized: AttestationConfig = serde_yaml::from_str(&serialized)?;

        assert_eq!(cfg, deserialized);

        Ok(())
    }

    #[test]
    fn test_add_symbols_works() -> Result<(), ErrBox> {
        let empty_config = AttestationConfig {
            min_msg_reuse_interval_ms:    1000,
            max_msg_accounts:             100,
            min_rpc_interval_ms:          42422,
            mapping_addr:                 None,
            mapping_reload_interval_mins: 42,
            symbol_groups:                vec![],
        };

        let mock_new_symbols = (0..255)
            .map(|sym_idx| {
                let mut mock_prod_bytes = [0u8; 32];
                mock_prod_bytes[31] = sym_idx;

                let mut mock_prices = HashSet::new();
                for px_idx in 1..=5 {
                    let mut mock_price_bytes = [0u8; 32];
                    mock_price_bytes[31] = sym_idx;
                    mock_prices.insert(Pubkey::new_from_array(mock_price_bytes));
                }

                (Pubkey::new_from_array(mock_prod_bytes), mock_prices)
            })
            .collect::<HashMap<Pubkey, HashSet<Pubkey>>>();

        let mut config1 = empty_config.clone();

        config1.add_symbols(mock_new_symbols.clone(), "default".to_owned());

        let mut config2 = config1.clone();

        // Should not be created because there's no new symbols to add
        // (we're adding identical mock_new_symbols again)
        config2.add_symbols(mock_new_symbols.clone(), "default2".to_owned());

        assert_ne!(config1, empty_config); // Check that config grows from empty
        assert_eq!(config1, config2); // Check that no changes are made if all symbols are already in there

        Ok(())
    }
}

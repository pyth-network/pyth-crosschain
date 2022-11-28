use std::{
    collections::{
        HashMap,
        HashSet,
    },
    iter,
    str::FromStr,
};

use log::info;

use serde::{
    de::Error,
    Deserialize,
    Deserializer,
    Serialize,
    Serializer,
};
use solana_program::pubkey::Pubkey;

use crate::BatchState;

/// Pyth2wormhole config specific to attestation requests
#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
pub struct AttestationConfig {
    #[serde(default = "default_min_msg_reuse_interval_ms")]
    pub min_msg_reuse_interval_ms: u64,
    #[serde(default = "default_max_msg_accounts")]
    pub max_msg_accounts: u64,
    /// Optionally, we take a mapping account to add remaining symbols from a Pyth deployments. These symbols are processed under attestation conditions for the `default` symbol group.
    #[serde(
        deserialize_with = "opt_pubkey_string_de",
        serialize_with = "opt_pubkey_string_ser",
        default // Uses Option::default() which is None
    )]
    pub mapping_addr: Option<Pubkey>,
    /// Collection of symbols identified by symbol name (e.g., "Crypto.BTC/USD")
    /// These symbols are only active if `mapping_addr` is set.
    pub mapping_groups: Vec<NameGroup>,
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
    pub min_rpc_interval_ms: u64,
    /// Collection of symbols identified by their full account addresses.
    /// These symbols will be published regardless of whether or not `mapping_addr` is provided.
    pub symbol_groups: Vec<SymbolGroup>,
}

impl AttestationConfig {
    pub fn as_batches(&self, max_batch_size: usize) -> Vec<SymbolGroup> {
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
                        SymbolGroup {
                            group_name: name4closure.clone(),
                            symbols: symbols.to_vec(),
                            conditions: conditions4closure.clone()
                        }
                    })
            })
            .flatten()
            .collect()
    }
}

#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
pub struct NameGroup {
    pub group_name: String,
    /// Attestation conditions applied to all symbols in this group
    /// TODO: make optional?
    pub conditions: AttestationConditions,
    /// The names of the symbols to include in this group
    pub symbol_names: Vec<String>,
}

#[derive(Clone, Debug, Hash, Deserialize, Serialize, PartialEq)]
pub struct SymbolGroup {
    pub group_name: String,
    /// Attestation conditions applied to all symbols in this group
    pub conditions: AttestationConditions,
    pub symbols: Vec<P2WSymbol>,
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
            min_interval_secs: default_min_interval_secs(),
            max_batch_jobs: default_max_batch_jobs(),
            price_changed_bps: None,
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
    pub price_addr: Pubkey,
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
    use super::*;

    use solitaire::ErrBox;

    #[test]
    fn test_sanity() -> Result<(), ErrBox> {
        let fastbois = SymbolGroup {
            group_name: "fast bois".to_owned(),
            conditions: AttestationConditions {
                min_interval_secs: 5,
                ..Default::default()
            },
            symbols: vec![
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
            symbols: vec![
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
            min_msg_reuse_interval_ms: 1000,
            max_msg_accounts: 100_000,
            min_rpc_interval_ms: 2123,
            mapping_addr: None,
            mapping_groups: vec![],
            mapping_reload_interval_mins: 42,
            symbol_groups: vec![fastbois, slowbois],
        };

        let serialized = serde_yaml::to_string(&cfg)?;

        let deserialized: AttestationConfig = serde_yaml::from_str(&serialized)?;

        assert_eq!(cfg, deserialized);

        Ok(())
    }
}

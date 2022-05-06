use std::{
    collections::HashMap,
    str::FromStr,
};

use serde::{
    de::Error,
    Deserialize,
    Deserializer,
    Serialize,
    Serializer,
};
use solana_program::pubkey::Pubkey;

/// Pyth2wormhole config specific to attestation requests
#[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct AttestationConfig {
    pub symbol_groups: Vec<SymbolGroup>,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SymbolGroup {
    pub group_name: String,
    /// Attestation conditions applied to all symbols in this group
    pub conditions: AttestationConditions,
    pub symbols: Vec<P2WSymbol>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct AttestationConditions {
    /// How often to attest
    pub min_freq_secs: u64,
}

/// Config entry for a Pyth product + price pair
#[derive(Default, Debug, Deserialize, Serialize, PartialEq, Eq)]
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

#[cfg(test)]
mod tests {
    use super::*;

    use solitaire::ErrBox;

    #[test]
    fn test_sanity() -> Result<(), ErrBox> {
        let fastbois = SymbolGroup {
            group_name: "fast bois".to_owned(),
            conditions: AttestationConditions { min_freq_secs: 5 },
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
            conditions: AttestationConditions { min_freq_secs: 200 },
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
            symbol_groups: vec![fastbois, slowbois],
        };

        let serialized = serde_yaml::to_string(&cfg)?;

        let deserialized: AttestationConfig = serde_yaml::from_str(&serialized)?;

        assert_eq!(cfg, deserialized);

        Ok(())
    }
}

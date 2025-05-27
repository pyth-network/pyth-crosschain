pub mod u256 {
    use {
        ethers::types::U256,
        serde::{de::Error, Deserialize, Deserializer, Serializer},
    };

    pub fn serialize<S>(b: &U256, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        s.serialize_str(b.to_string().as_str())
    }

    pub fn deserialize<'de, D>(d: D) -> Result<U256, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = Deserialize::deserialize(d)?;
        U256::from_dec_str(s.as_str()).map_err(|err| D::Error::custom(err.to_string()))
    }
}

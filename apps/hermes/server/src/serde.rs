pub mod hex {
    use {
        hex::FromHex,
        serde::{de::IntoDeserializer, Deserialize, Deserializer, Serializer},
    };

    pub fn serialize<S, const N: usize>(b: &[u8; N], s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        s.serialize_str(hex::encode(b).as_str())
    }

    pub fn deserialize<'de, D, R>(d: D) -> Result<R, D::Error>
    where
        D: Deserializer<'de>,
        R: FromHex,
        <R as hex::FromHex>::Error: std::fmt::Display,
    {
        let full: String = Deserialize::deserialize(d)?;
        let hex = full
            .strip_prefix("0x")
            .or_else(|| full.strip_prefix("0X"))
            .unwrap_or(&full);
        hex::serde::deserialize(hex.into_deserializer())
    }

    #[cfg(test)]
    #[allow(clippy::unwrap_used, reason = "tests")]
    mod tests {
        use serde::Deserialize;

        #[derive(Debug, Deserialize, PartialEq)]
        struct H(#[serde(with = "super")] [u8; 32]);

        #[test]
        fn test_deserialize() {
            let e = H([
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab,
                0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67,
                0x89, 0xab, 0xcd, 0xef,
            ]);

            let l = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\"";
            let u = "\"0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\"";
            assert_eq!(serde_json::from_str::<H>(l).unwrap(), e);
            assert_eq!(serde_json::from_str::<H>(u).unwrap(), e);

            let l = "\"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\"";
            let u = "\"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\"";
            assert_eq!(serde_json::from_str::<H>(l).unwrap(), e);
            assert_eq!(serde_json::from_str::<H>(u).unwrap(), e);
        }

        #[test]
        fn test_deserialize_invalid_length() {
            let l = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde\"";
            let u = "\"0X0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDE\"";
            assert!(serde_json::from_str::<H>(l).is_err());
            assert!(serde_json::from_str::<H>(u).is_err());

            let l = "\"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde\"";
            let u = "\"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDE\"";
            assert!(serde_json::from_str::<H>(l).is_err());
            assert!(serde_json::from_str::<H>(u).is_err());
        }

        #[test]
        fn test_deserialize_invalid_hex() {
            let l = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg\"";
            let u = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg\"";
            assert!(serde_json::from_str::<H>(l).is_err());
            assert!(serde_json::from_str::<H>(u).is_err());

            let l = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg\"";
            let u = "\"0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg\"";
            assert!(serde_json::from_str::<H>(l).is_err());
            assert!(serde_json::from_str::<H>(u).is_err());
        }
    }
}

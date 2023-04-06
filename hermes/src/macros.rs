#[macro_export]
/// A macro that generates Deserialize for serde for a struct S that wraps [u8; N] where N is a compile-time constant.
macro_rules! impl_deserialize_for_hex_string_wrapper {
    ($struct_name:ident, $array_size:expr) => {
        impl<'de> serde::Deserialize<'de> for $struct_name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct HexVisitor;

                impl<'de> serde::de::Visitor<'de> for HexVisitor {
                    type Value = [u8; $array_size];

                    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                        write!(formatter, "a hex string of length {}", $array_size * 2)
                    }

                    fn visit_str<E>(self, s: &str) -> Result<Self::Value, E>
                    where
                        E: serde::de::Error,
                    {
                        let s = s.trim_start_matches("0x");
                        let bytes = hex::decode(s)
                            .map_err(|_| E::invalid_value(serde::de::Unexpected::Str(s), &self))?;
                        if bytes.len() != $array_size {
                            return Err(E::invalid_length(bytes.len(), &self));
                        }
                        let mut array = [0_u8; $array_size];
                        array.copy_from_slice(&bytes);
                        Ok(array)
                    }
                }

                deserializer.deserialize_str(HexVisitor).map($struct_name)
            }
        }
    };
}

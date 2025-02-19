//! Constants and values common to every p2w custom-serialized message.
//!
//! The format makes no attempt to provide human-readable symbol names
//! in favor of explicit product/price Solana account addresses
//! (IDs). This choice was made to disambiguate any symbols with
//! similar human-readable names and provide a failsafe for some of
//! the probable adversarial scenarios.

pub use pyth_sdk::{Identifier, PriceStatus, UnixTimestamp};
use {
    serde::{Deserialize, Serialize, Serializer},
    std::{convert::TryInto, io::Read, iter::Iterator, mem},
};

pub type ErrBox = Box<dyn std::error::Error>;

/// Precedes every message implementing the p2w serialization format
pub const P2W_MAGIC: &[u8] = b"P2WH";

/// Format version used and understood by this codebase
pub const P2W_FORMAT_VER_MAJOR: u16 = 3;

/// Starting with v3, format introduces a minor version to mark
/// forward-compatible iterations.
/// IMPORTANT: Remember to reset this to 0 whenever major version is
/// bumped.
/// Changelog:
/// * v3.1 - last_attested_publish_time field added
pub const P2W_FORMAT_VER_MINOR: u16 = 1;

/// Starting with v3, format introduces append-only
/// forward-compatibility to the header. This is the current number of
/// bytes after the hdr_size field. After the specified bytes, inner
/// payload-specific fields begin.
pub const P2W_FORMAT_HDR_SIZE: u16 = 1;

pub const PUBKEY_LEN: usize = 32;

/// Decides the format of following bytes
#[repr(u8)]
pub enum PayloadId {
    PriceAttestation = 1, // Not in use, currently batch attestations imply PriceAttestation messages inside
    PriceBatchAttestation = 2,
}

/// The main attestation data type.
///
/// Important: For maximum security, *both* product_id and price_id
/// should be used as storage keys for known attestations in target
/// chain logic.
///
/// NOTE(2022-04-25): the serde attributes help prevent math errors,
/// and no less annoying low-effort serialization override method is known.
#[derive(Clone, Default, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceAttestation {
    #[serde(serialize_with = "pubkey_to_hex")]
    pub product_id: Identifier,
    #[serde(serialize_with = "pubkey_to_hex")]
    pub price_id: Identifier,
    #[serde(serialize_with = "use_to_string")]
    pub price: i64,
    #[serde(serialize_with = "use_to_string")]
    pub conf: u64,
    pub expo: i32,
    #[serde(serialize_with = "use_to_string")]
    pub ema_price: i64,
    #[serde(serialize_with = "use_to_string")]
    pub ema_conf: u64,
    pub status: PriceStatus,
    pub num_publishers: u32,
    pub max_num_publishers: u32,
    pub attestation_time: UnixTimestamp,
    pub publish_time: UnixTimestamp,
    pub prev_publish_time: UnixTimestamp,
    #[serde(serialize_with = "use_to_string")]
    pub prev_price: i64,
    #[serde(serialize_with = "use_to_string")]
    pub prev_conf: u64,
    pub last_attested_publish_time: UnixTimestamp,
}

/// Helper allowing ToString implementers to be serialized as strings accordingly
pub fn use_to_string<T, S>(val: &T, s: S) -> Result<S::Ok, S::Error>
where
    T: ToString,
    S: Serializer,
{
    s.serialize_str(&val.to_string())
}

pub fn pubkey_to_hex<S>(val: &Identifier, s: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    s.serialize_str(&hex::encode(val.to_bytes()))
}

#[derive(Clone, Default, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchPriceAttestation {
    pub price_attestations: Vec<PriceAttestation>,
}

impl BatchPriceAttestation {
    /// Turn a bunch of attestations into a combined payload.
    ///
    /// Batches assume constant-size attestations within a single batch.
    pub fn serialize(&self) -> Result<Vec<u8>, ErrBox> {
        // magic
        let mut buf = P2W_MAGIC.to_vec();

        // major_version
        buf.extend_from_slice(&P2W_FORMAT_VER_MAJOR.to_be_bytes()[..]);

        // minor_version
        buf.extend_from_slice(&P2W_FORMAT_VER_MINOR.to_be_bytes()[..]);

        // hdr_size
        buf.extend_from_slice(&P2W_FORMAT_HDR_SIZE.to_be_bytes()[..]);

        // payload_id
        buf.push(PayloadId::PriceBatchAttestation as u8);

        // Header is over. NOTE: If you need to append to the header,
        // make sure that the number of bytes after hdr_size is
        // reflected in the P2W_FORMAT_HDR_SIZE constant.

        // n_attestations
        buf.extend_from_slice(&(self.price_attestations.len() as u16).to_be_bytes()[..]);

        let mut attestation_size = 0; // Will be determined as we serialize attestations
        let mut serialized_attestations = Vec::with_capacity(self.price_attestations.len());
        for (idx, a) in self.price_attestations.iter().enumerate() {
            // Learn the current attestation's size
            let serialized = PriceAttestation::serialize(a);
            let a_len = serialized.len();

            // Verify it's the same as the first one we saw for the batch, assign if we're first.
            if attestation_size > 0 {
                if a_len != attestation_size {
                    return Err(format!(
                        "attestation {} serializes to {} bytes, {} expected",
                        idx + 1,
                        a_len,
                        attestation_size
                    )
                    .into());
                }
            } else {
                attestation_size = a_len;
            }

            serialized_attestations.push(serialized);
        }

        // attestation_size
        buf.extend_from_slice(&(attestation_size as u16).to_be_bytes()[..]);

        for mut s in serialized_attestations.into_iter() {
            buf.append(&mut s)
        }

        Ok(buf)
    }

    pub fn deserialize(mut bytes: impl Read) -> Result<Self, ErrBox> {
        let mut magic_vec = vec![0u8; P2W_MAGIC.len()];
        bytes.read_exact(magic_vec.as_mut_slice())?;

        if magic_vec.as_slice() != P2W_MAGIC {
            return Err(
                format!("Invalid magic {magic_vec:02X?}, expected {P2W_MAGIC:02X?}",).into(),
            );
        }

        let mut major_version_vec = vec![0u8; mem::size_of_val(&P2W_FORMAT_VER_MAJOR)];
        bytes.read_exact(major_version_vec.as_mut_slice())?;
        let major_version = u16::from_be_bytes(major_version_vec.as_slice().try_into()?);

        // Major must match exactly
        if major_version != P2W_FORMAT_VER_MAJOR {
            return Err(format!(
                "Unsupported format major_version {major_version}, expected {P2W_FORMAT_VER_MAJOR}"
            )
            .into());
        }

        let mut minor_version_vec = vec![0u8; mem::size_of_val(&P2W_FORMAT_VER_MINOR)];
        bytes.read_exact(minor_version_vec.as_mut_slice())?;
        let minor_version = u16::from_be_bytes(minor_version_vec.as_slice().try_into()?);

        // Only older minors are not okay for this codebase
        if minor_version < P2W_FORMAT_VER_MINOR {
            return Err(format!(
                "Unsupported format minor_version {minor_version}, expected {P2W_FORMAT_VER_MINOR} or more"
            )
            .into());
        }

        // Read header size value
        let mut hdr_size_vec = vec![0u8; mem::size_of_val(&P2W_FORMAT_HDR_SIZE)];
        bytes.read_exact(hdr_size_vec.as_mut_slice())?;
        let hdr_size = u16::from_be_bytes(hdr_size_vec.as_slice().try_into()?);

        // Consume the declared number of remaining header
        // bytes. Remaining header fields must be read from hdr_buf
        let mut hdr_buf = vec![0u8; hdr_size as usize];
        bytes.read_exact(hdr_buf.as_mut_slice())?;

        let mut payload_id_vec = vec![0u8; mem::size_of::<PayloadId>()];
        hdr_buf
            .as_slice()
            .read_exact(payload_id_vec.as_mut_slice())?;

        if payload_id_vec[0] != PayloadId::PriceBatchAttestation as u8 {
            return Err(format!(
                "Invalid Payload ID {}, expected {}",
                payload_id_vec[0],
                PayloadId::PriceBatchAttestation as u8,
            )
            .into());
        }

        // Header consumed, continue with remaining fields
        let mut batch_len_vec = vec![0u8; 2];
        bytes.read_exact(batch_len_vec.as_mut_slice())?;
        let batch_len = u16::from_be_bytes(batch_len_vec.as_slice().try_into()?);

        let mut attestation_size_vec = vec![0u8; 2];
        bytes.read_exact(attestation_size_vec.as_mut_slice())?;
        let attestation_size = u16::from_be_bytes(attestation_size_vec.as_slice().try_into()?);

        let mut ret = Vec::with_capacity(batch_len as usize);

        for i in 0..batch_len {
            let mut attestation_buf = vec![0u8; attestation_size as usize];
            bytes.read_exact(attestation_buf.as_mut_slice())?;

            match PriceAttestation::deserialize(attestation_buf.as_slice()) {
                Ok(attestation) => ret.push(attestation),
                Err(e) => {
                    return Err(format!("PriceAttestation {}/{}: {}", i + 1, batch_len, e).into())
                }
            }
        }

        Ok(Self {
            price_attestations: ret,
        })
    }
}

// On-chain data types

impl PriceAttestation {
    /// Serialize this attestation according to the Pyth-over-wormhole serialization format
    pub fn serialize(&self) -> Vec<u8> {
        // A nifty trick to get us yelled at if we forget to serialize a field
        #[deny(warnings)]
        let PriceAttestation {
            product_id,
            price_id,
            price,
            conf,
            expo,
            ema_price,
            ema_conf,
            status,
            num_publishers,
            max_num_publishers,
            attestation_time,
            publish_time,
            prev_publish_time,
            prev_price,
            prev_conf,
            last_attested_publish_time,
        } = self;

        let mut buf = Vec::new();

        // product_id
        buf.extend_from_slice(&product_id.to_bytes()[..]);

        // price_id
        buf.extend_from_slice(&price_id.to_bytes()[..]);

        // price
        buf.extend_from_slice(&price.to_be_bytes()[..]);

        // conf
        buf.extend_from_slice(&conf.to_be_bytes()[..]);

        // expo
        buf.extend_from_slice(&expo.to_be_bytes()[..]);

        // ema_price
        buf.extend_from_slice(&ema_price.to_be_bytes()[..]);

        // ema_conf
        buf.extend_from_slice(&ema_conf.to_be_bytes()[..]);

        // status
        buf.push(*status as u8);

        // num_publishers
        buf.extend_from_slice(&num_publishers.to_be_bytes()[..]);

        // max_num_publishers
        buf.extend_from_slice(&max_num_publishers.to_be_bytes()[..]);

        // attestation_time
        buf.extend_from_slice(&attestation_time.to_be_bytes()[..]);

        // publish_time
        buf.extend_from_slice(&publish_time.to_be_bytes()[..]);

        // prev_publish_time
        buf.extend_from_slice(&prev_publish_time.to_be_bytes()[..]);

        // prev_price
        buf.extend_from_slice(&prev_price.to_be_bytes()[..]);

        // prev_conf
        buf.extend_from_slice(&prev_conf.to_be_bytes()[..]);

        // last_attested_publish_time
        buf.extend_from_slice(&last_attested_publish_time.to_be_bytes()[..]);

        buf
    }
    pub fn deserialize(mut bytes: impl Read) -> Result<Self, ErrBox> {
        let mut product_id_vec = vec![0u8; PUBKEY_LEN];
        bytes.read_exact(product_id_vec.as_mut_slice())?;
        let product_id = Identifier::new(product_id_vec.as_slice().try_into()?);

        let mut price_id_vec = vec![0u8; PUBKEY_LEN];
        bytes.read_exact(price_id_vec.as_mut_slice())?;
        let price_id = Identifier::new(price_id_vec.as_slice().try_into()?);

        let mut price_vec = vec![0u8; mem::size_of::<i64>()];
        bytes.read_exact(price_vec.as_mut_slice())?;
        let price = i64::from_be_bytes(price_vec.as_slice().try_into()?);

        let mut conf_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(conf_vec.as_mut_slice())?;
        let conf = u64::from_be_bytes(conf_vec.as_slice().try_into()?);

        let mut expo_vec = vec![0u8; mem::size_of::<i32>()];
        bytes.read_exact(expo_vec.as_mut_slice())?;
        let expo = i32::from_be_bytes(expo_vec.as_slice().try_into()?);

        let mut ema_price_vec = vec![0u8; mem::size_of::<i64>()];
        bytes.read_exact(ema_price_vec.as_mut_slice())?;
        let ema_price = i64::from_be_bytes(ema_price_vec.as_slice().try_into()?);

        let mut ema_conf_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(ema_conf_vec.as_mut_slice())?;
        let ema_conf = u64::from_be_bytes(ema_conf_vec.as_slice().try_into()?);

        let mut status_vec = vec![0u8];
        bytes.read_exact(status_vec.as_mut_slice())?;
        let status = match status_vec[0] {
            a if a == PriceStatus::Unknown as u8 => PriceStatus::Unknown,
            a if a == PriceStatus::Trading as u8 => PriceStatus::Trading,
            a if a == PriceStatus::Halted as u8 => PriceStatus::Halted,
            a if a == PriceStatus::Auction as u8 => PriceStatus::Auction,
            other => {
                return Err(format!("Invalid status value {other}").into());
            }
        };

        let mut num_publishers_vec = vec![0u8; mem::size_of::<u32>()];
        bytes.read_exact(num_publishers_vec.as_mut_slice())?;
        let num_publishers = u32::from_be_bytes(num_publishers_vec.as_slice().try_into()?);

        let mut max_num_publishers_vec = vec![0u8; mem::size_of::<u32>()];
        bytes.read_exact(max_num_publishers_vec.as_mut_slice())?;
        let max_num_publishers = u32::from_be_bytes(max_num_publishers_vec.as_slice().try_into()?);

        let mut attestation_time_vec = vec![0u8; mem::size_of::<UnixTimestamp>()];
        bytes.read_exact(attestation_time_vec.as_mut_slice())?;
        let attestation_time =
            UnixTimestamp::from_be_bytes(attestation_time_vec.as_slice().try_into()?);

        let mut publish_time_vec = vec![0u8; mem::size_of::<UnixTimestamp>()];
        bytes.read_exact(publish_time_vec.as_mut_slice())?;
        let publish_time = UnixTimestamp::from_be_bytes(publish_time_vec.as_slice().try_into()?);

        let mut prev_publish_time_vec = vec![0u8; mem::size_of::<UnixTimestamp>()];
        bytes.read_exact(prev_publish_time_vec.as_mut_slice())?;
        let prev_publish_time =
            UnixTimestamp::from_be_bytes(prev_publish_time_vec.as_slice().try_into()?);

        let mut prev_price_vec = vec![0u8; mem::size_of::<i64>()];
        bytes.read_exact(prev_price_vec.as_mut_slice())?;
        let prev_price = i64::from_be_bytes(prev_price_vec.as_slice().try_into()?);

        let mut prev_conf_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(prev_conf_vec.as_mut_slice())?;
        let prev_conf = u64::from_be_bytes(prev_conf_vec.as_slice().try_into()?);

        let mut last_attested_publish_time_vec = vec![0u8; mem::size_of::<UnixTimestamp>()];
        bytes.read_exact(last_attested_publish_time_vec.as_mut_slice())?;
        let last_attested_publish_time =
            UnixTimestamp::from_be_bytes(last_attested_publish_time_vec.as_slice().try_into()?);

        Ok(Self {
            product_id,
            price_id,
            price,
            conf,
            expo,
            ema_price,
            ema_conf,
            status,
            num_publishers,
            max_num_publishers,
            attestation_time,
            publish_time,
            prev_publish_time,
            prev_price,
            prev_conf,
            last_attested_publish_time,
        })
    }
}

/// This test suite of the format doubles as a test payload generator;
/// print statements help provide plausible serialized data on demand
/// using `cargo test -- --nocapture`.
#[cfg(test)]
mod tests {
    use super::*;

    fn mock_attestation(prod: Option<[u8; 32]>, price: Option<[u8; 32]>) -> PriceAttestation {
        let product_id_bytes = prod.unwrap_or([21u8; 32]);
        let price_id_bytes = price.unwrap_or([222u8; 32]);
        PriceAttestation {
            product_id: Identifier::new(product_id_bytes),
            price_id: Identifier::new(price_id_bytes),
            price: 0x2bad2feed7,
            conf: 101,
            ema_price: -42,
            ema_conf: 42,
            expo: -3,
            status: PriceStatus::Trading,
            num_publishers: 123212u32,
            max_num_publishers: 321232u32,
            attestation_time: (0xdeadbeeffadedeedu64) as i64,
            publish_time: 0xdadebeefi64,
            prev_publish_time: 0xdeadbabei64,
            prev_price: 0xdeadfacebeefi64,
            prev_conf: 0xbadbadbeefu64, // I could do this all day -SD
            last_attested_publish_time: (0xdeadbeeffadedeafu64) as i64,
        }
    }

    #[test]
    fn test_attestation_serde() -> Result<(), ErrBox> {
        let product_id_bytes = [21u8; 32];
        let price_id_bytes = [222u8; 32];
        let attestation: PriceAttestation =
            mock_attestation(Some(product_id_bytes), Some(price_id_bytes));

        println!("Hex product_id: {:02X?}", &product_id_bytes);
        println!("Hex price_id: {:02X?}", &price_id_bytes);

        println!("Regular: {:#?}", &attestation);
        println!("Hex: {:#02X?}", &attestation);
        let bytes = attestation.serialize();
        println!("Hex Bytes: {bytes:02X?}");

        assert_eq!(
            PriceAttestation::deserialize(bytes.as_slice())?,
            attestation
        );
        Ok(())
    }

    #[test]
    fn test_attestation_serde_wrong_size() -> Result<(), ErrBox> {
        assert!(PriceAttestation::deserialize(&[][..]).is_err());
        assert!(PriceAttestation::deserialize(vec![0u8; 1].as_slice()).is_err());
        Ok(())
    }

    #[test]
    fn test_batch_serde() -> Result<(), ErrBox> {
        let attestations: Vec<_> = (1..=3)
            .map(|i| {
                mock_attestation(
                    Some([(i % 256) as u8; 32]),
                    Some([(255 - (i % 256)) as u8; 32]),
                )
            })
            .collect();

        let batch_attestation = BatchPriceAttestation {
            price_attestations: attestations,
        };
        println!("Batch hex struct: {batch_attestation:#02X?}");

        let serialized = batch_attestation.serialize()?;
        println!("Batch hex Bytes: {serialized:02X?}");

        let deserialized: BatchPriceAttestation =
            BatchPriceAttestation::deserialize(serialized.as_slice())?;

        assert_eq!(batch_attestation, deserialized);

        Ok(())
    }

    #[test]
    fn test_batch_serde_wrong_size() -> Result<(), ErrBox> {
        assert!(BatchPriceAttestation::deserialize(&[][..]).is_err());
        assert!(BatchPriceAttestation::deserialize(vec![0u8; 1].as_slice()).is_err());

        let attestations: Vec<_> = (0..20)
            .map(|i| mock_attestation(Some([(i % 256) as u8; 32]), None))
            .collect();

        let batch_attestation = BatchPriceAttestation {
            price_attestations: attestations,
        };

        let serialized = batch_attestation.serialize()?;

        // Missing last byte in last attestation must be an error
        let len = serialized.len();
        assert!(BatchPriceAttestation::deserialize(&serialized.as_slice()[..len - 1]).is_err());

        Ok(())
    }
}

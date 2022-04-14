//! Constants and values common to every p2w custom-serialized message.
//!
//! The format makes no attempt to provide human-readable symbol names
//! in favor of explicit product/price Solana account addresses
//! (IDs). This choice was made to disambiguate any symbols with
//! similar human-readable names and provide a failsafe for some of
//! the probable adversarial scenarios.

use std::borrow::Borrow;
use std::convert::TryInto;
use std::io::Read;
use std::iter::Iterator;
use std::mem;

use pyth_sdk_solana::state::{
    CorpAction,
    PriceStatus,
    PriceType,
    Rational,
};

#[cfg(feature = "solana")]
use solitaire::{
    Derive,
    Info,
};

use solana_program::clock::UnixTimestamp;
use solana_program::pubkey::Pubkey;

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod wasm;

/// Quality of life type alias for wrapping up boxed errors.
pub type ErrBox = Box<dyn std::error::Error>;

/// Precedes every message implementing the p2w serialization format
pub const P2W_MAGIC: &'static [u8] = b"P2WH";

/// Format version used and understood by this codebase
pub const P2W_FORMAT_VERSION: u16 = 2;

pub const PUBKEY_LEN: usize = 32;

/// Emmitter Address to wormhole is a PDA with seed p2w-emmiter from attestation contract
#[cfg(feature = "solana")]
pub type P2WEmitter<'b> = Derive<Info<'b>, "p2w-emitter">;

/// Decides the format of following bytes
#[repr(u8)]
pub enum PayloadId {
    PriceAttestation      = 1, // Not in use, currently batch attestations imply PriceAttestation messages inside
    PriceBatchAttestation = 2,
}

// On-chain data types

/// The main attestation data type.
///
/// Important: For maximum security, *both* product_id and price_id
/// should be used as storage keys for known attestations in target
/// chain logic.
#[derive(Clone, Default, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PriceAttestation {
    pub product_id:          Pubkey,
    pub price_id:            Pubkey,
    pub price_type:          PriceType,
    pub price:               i64,
    pub expo:                i32,
    pub ema_price:           Rational,
    pub ema_conf:            Rational,
    pub confidence_interval: u64,
    pub status:              PriceStatus,
    pub corp_act:            CorpAction,
    pub timestamp:           UnixTimestamp,
    pub num_publishers:      u32,
    pub max_num_publishers:  u32,
}

#[derive(Clone, Default, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
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

        // version
        buf.extend_from_slice(&P2W_FORMAT_VERSION.to_be_bytes()[..]);

        // payload_id
        buf.push(PayloadId::PriceBatchAttestation as u8);

        // n_attestations
        buf.extend_from_slice(&(self.price_attestations.len() as u16).to_be_bytes()[..]);

        let mut attestation_size = 0; // Will be determined as we serialize attestations
        let mut serialized_attestations = Vec::with_capacity(self.price_attestations.len());
        for (idx, a) in self.price_attestations.iter().enumerate() {
            // Learn the current attestation's size
            let serialized = PriceAttestation::serialize(a.borrow());
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
            return Err(format!(
                "Invalid magic {:02X?}, expected {:02X?}",
                magic_vec, P2W_MAGIC,
            )
            .into());
        }

        let mut version_vec = vec![0u8; mem::size_of_val(&P2W_FORMAT_VERSION)];
        bytes.read_exact(version_vec.as_mut_slice())?;
        let version = u16::from_be_bytes(version_vec.as_slice().try_into()?);

        if version != P2W_FORMAT_VERSION {
            return Err(format!(
                "Unsupported format version {}, expected {}",
                version, P2W_FORMAT_VERSION
            )
            .into());
        }

        let mut payload_id_vec = vec![0u8; mem::size_of::<PayloadId>()];
        bytes.read_exact(payload_id_vec.as_mut_slice())?;

        if payload_id_vec[0] != PayloadId::PriceBatchAttestation as u8 {
            return Err(format!(
                "Invalid Payload ID {}, expected {}",
                payload_id_vec[0],
                PayloadId::PriceBatchAttestation as u8,
            )
            .into());
        }

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

            dbg!(&attestation_buf.len());

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

pub fn serialize_rational(rational: &Rational) -> Vec<u8> {
    let mut v = vec![];
    // val
    v.extend(&rational.val.to_be_bytes()[..]);

    // numer
    v.extend(&rational.numer.to_be_bytes()[..]);

    // denom
    v.extend(&rational.denom.to_be_bytes()[..]);

    v
}

pub fn deserialize_rational(mut bytes: impl Read) -> Result<Rational, ErrBox> {
    let mut val_vec = vec![0u8; mem::size_of::<i64>()];
    bytes.read_exact(val_vec.as_mut_slice())?;
    let val = i64::from_be_bytes(val_vec.as_slice().try_into()?);

    let mut numer_vec = vec![0u8; mem::size_of::<i64>()];
    bytes.read_exact(numer_vec.as_mut_slice())?;
    let numer = i64::from_be_bytes(numer_vec.as_slice().try_into()?);

    let mut denom_vec = vec![0u8; mem::size_of::<i64>()];
    bytes.read_exact(denom_vec.as_mut_slice())?;
    let denom = i64::from_be_bytes(denom_vec.as_slice().try_into()?);

    Ok(Rational { val, numer, denom })
}

// On-chain data types

impl PriceAttestation {
    pub fn from_pyth_price_bytes(
        price_id: Pubkey,
        timestamp: UnixTimestamp,
        value: &[u8],
    ) -> Result<Self, ErrBox> {
        let price = pyth_sdk_solana::state::load_price_account(value)?;

        Ok(PriceAttestation {
            product_id: Pubkey::new(&price.prod.val[..]),
            price_id,
            price_type: price.ptype,
            price: price.agg.price,
            ema_price: price.ema_price,
            ema_conf: price.ema_conf,
            expo: price.expo,
            confidence_interval: price.agg.conf,
            status: price.agg.status,
            corp_act: price.agg.corp_act,
            timestamp: timestamp,
            num_publishers: price.num_qt,
	    max_num_publishers: price.num,
        })
    }

    /// Serialize this attestation according to the Pyth-over-wormhole serialization format
    pub fn serialize(&self) -> Vec<u8> {
        // A nifty trick to get us yelled at if we forget to serialize a field
        #[deny(warnings)]
        let PriceAttestation {
            product_id,
            price_id,
            price_type,
            price,
            expo,
            ema_price,
            ema_conf,
            confidence_interval,
            status,
            corp_act,
            timestamp,
            num_publishers,
            max_num_publishers,
        } = self;

        // magic
        let mut buf = P2W_MAGIC.to_vec();

        // version
        buf.extend_from_slice(&P2W_FORMAT_VERSION.to_be_bytes()[..]);

        // payload_id
        buf.push(PayloadId::PriceAttestation as u8);

        // product_id
        buf.extend_from_slice(&product_id.to_bytes()[..]);

        // price_id
        buf.extend_from_slice(&price_id.to_bytes()[..]);

        // price_type
        buf.push(price_type.clone() as u8);

        // price
        buf.extend_from_slice(&price.to_be_bytes()[..]);

        // exponent
        buf.extend_from_slice(&expo.to_be_bytes()[..]);

        // ema_price
        buf.append(&mut serialize_rational(&ema_price));

        // ema_conf
        buf.append(&mut serialize_rational(&ema_conf));

        // confidence_interval
        buf.extend_from_slice(&confidence_interval.to_be_bytes()[..]);

        // status
        buf.push(status.clone() as u8);

        // corp_act
        buf.push(corp_act.clone() as u8);

        // timestamp
        buf.extend_from_slice(&timestamp.to_be_bytes()[..]);

        // num_publishers
        buf.extend_from_slice(&num_publishers.to_be_bytes()[..]);

        // max_num_publishers
        buf.extend_from_slice(&max_num_publishers.to_be_bytes()[..]);

        buf
    }
    pub fn deserialize(mut bytes: impl Read) -> Result<Self, ErrBox> {
        let mut magic_vec = vec![0u8; P2W_MAGIC.len()];

        bytes.read_exact(magic_vec.as_mut_slice())?;

        if magic_vec.as_slice() != P2W_MAGIC {
            return Err(format!(
                "Invalid magic {:02X?}, expected {:02X?}",
                magic_vec, P2W_MAGIC,
            )
            .into());
        }

        let mut version_vec = vec![0u8; mem::size_of_val(&P2W_FORMAT_VERSION)];
        bytes.read_exact(version_vec.as_mut_slice())?;
        let version = u16::from_be_bytes(version_vec.as_slice().try_into()?);

        if version != P2W_FORMAT_VERSION {
            return Err(format!(
                "Unsupported format version {}, expected {}",
                version, P2W_FORMAT_VERSION
            )
            .into());
        }

        let mut payload_id_vec = vec![0u8; mem::size_of::<PayloadId>()];
        bytes.read_exact(payload_id_vec.as_mut_slice())?;

        if PayloadId::PriceAttestation as u8 != payload_id_vec[0] {
            return Err(format!(
                "Invalid Payload ID {}, expected {}",
                payload_id_vec[0],
                PayloadId::PriceAttestation as u8,
            )
            .into());
        }

        let mut product_id_vec = vec![0u8; PUBKEY_LEN];
        bytes.read_exact(product_id_vec.as_mut_slice())?;
        let product_id = Pubkey::new(product_id_vec.as_slice());

        let mut price_id_vec = vec![0u8; PUBKEY_LEN];
        bytes.read_exact(price_id_vec.as_mut_slice())?;
        let price_id = Pubkey::new(price_id_vec.as_slice());

        let mut price_type_vec = vec![0u8];
        bytes.read_exact(price_type_vec.as_mut_slice())?;
        let price_type = match price_type_vec[0] {
            a if a == PriceType::Price as u8 => PriceType::Price,
            a if a == PriceType::Unknown as u8 => PriceType::Unknown,
            other => {
                return Err(format!("Invalid price_type value {}", other).into());
            }
        };

        let mut price_vec = vec![0u8; mem::size_of::<i64>()];
        bytes.read_exact(price_vec.as_mut_slice())?;
        let price = i64::from_be_bytes(price_vec.as_slice().try_into()?);

        let mut expo_vec = vec![0u8; mem::size_of::<i32>()];
        bytes.read_exact(expo_vec.as_mut_slice())?;
        let expo = i32::from_be_bytes(expo_vec.as_slice().try_into()?);

        let ema_price = deserialize_rational(&mut bytes)?;
        let ema_conf = deserialize_rational(&mut bytes)?;

        println!("twac OK");
        let mut confidence_interval_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(confidence_interval_vec.as_mut_slice())?;
        let confidence_interval =
            u64::from_be_bytes(confidence_interval_vec.as_slice().try_into()?);

        let mut status_vec = vec![0u8];
        bytes.read_exact(status_vec.as_mut_slice())?;
        let status = match status_vec[0] {
            a if a == PriceStatus::Unknown as u8 => PriceStatus::Unknown,
            a if a == PriceStatus::Trading as u8 => PriceStatus::Trading,
            a if a == PriceStatus::Halted as u8 => PriceStatus::Halted,
            a if a == PriceStatus::Auction as u8 => PriceStatus::Auction,
            other => {
                return Err(format!("Invalid status value {}", other).into());
            }
        };

        let mut corp_act_vec = vec![0u8];
        bytes.read_exact(corp_act_vec.as_mut_slice())?;
        let corp_act = match corp_act_vec[0] {
            a if a == CorpAction::NoCorpAct as u8 => CorpAction::NoCorpAct,
            other => {
                return Err(format!("Invalid corp_act value {}", other).into());
            }
        };

        let mut timestamp_vec = vec![0u8; mem::size_of::<UnixTimestamp>()];
        bytes.read_exact(timestamp_vec.as_mut_slice())?;
        let timestamp = UnixTimestamp::from_be_bytes(timestamp_vec.as_slice().try_into()?);

        let mut num_publishers_vec = vec![0u8; mem::size_of::<u32>()];
        bytes.read_exact(num_publishers_vec.as_mut_slice())?;
        let num_publishers = u32::from_be_bytes(num_publishers_vec.as_slice().try_into()?);

        let mut max_num_publishers_vec = vec![0u8; mem::size_of::<u32>()];
        bytes.read_exact(max_num_publishers_vec.as_mut_slice())?;
        let max_num_publishers = u32::from_be_bytes(max_num_publishers_vec.as_slice().try_into()?);

        Ok(Self {
            product_id,
            price_id,
            price_type,
            price,
            expo,
            ema_price,
            ema_conf,
            confidence_interval,
            status,
            corp_act,
            timestamp,
            num_publishers,
	    max_num_publishers,
        })
    }
}

/// This test suite of the format doubles as a test payload generator;
/// print statements help provide plausible serialized data on demand
/// using `cargo test -- --nocapture`.
#[cfg(test)]
mod tests {
    use super::*;
    use pyth_sdk_solana::state::{
        PriceStatus,
        PriceType,
        Rational,
    };

    fn mock_attestation(prod: Option<[u8; 32]>, price: Option<[u8; 32]>) -> PriceAttestation {
        let product_id_bytes = prod.unwrap_or([21u8; 32]);
        let price_id_bytes = price.unwrap_or([222u8; 32]);
        PriceAttestation {
            product_id:          Pubkey::new_from_array(product_id_bytes),
            price_id:            Pubkey::new_from_array(price_id_bytes),
            price:               0x2bad2feed7,
            price_type:          PriceType::Price,
            ema_price:           Rational {
                val:   -42,
                numer: 15,
                denom: 37,
            },
            ema_conf:            Rational {
                val:   42,
                numer: 1111,
                denom: 2222,
            },
            expo:                -3,
            status:              PriceStatus::Trading,
            confidence_interval: 101,
            corp_act:            CorpAction::NoCorpAct,
            timestamp:           (0xdeadbeeffadedeedu64) as i64,
	    num_publishers: 123212u32,
	    max_num_publishers: 321232u32
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
        println!("Hex Bytes: {:02X?}", bytes);

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
        let attestations: Vec<_> = (1..=10)
            .map(|i| mock_attestation(Some([(i % 256) as u8; 32]), Some([(255 - (i % 256)) as u8; 32])))
            .collect();

        let batch_attestation = BatchPriceAttestation {
            price_attestations: attestations,
        };

        let serialized = batch_attestation.serialize()?;
        println!("Batch hex Bytes: {:02X?}", serialized);

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

//! A type to hold data for the [`Accumulator` sysvar][sv].
//!
//! TODO: replace this with an actual link if needed
//! [sv]: https://docs.pythnetwork.org/developing/runtime-facilities/sysvars#accumulator
//!
//! The sysvar ID is declared in [`sysvar::accumulator`].
//!
//! [`sysvar::accumulator`]: crate::sysvar::accumulator

use {
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    hex::FromHexError,
    pyth::{
        PayloadId,
        P2W_FORMAT_HDR_SIZE,
        P2W_FORMAT_VER_MAJOR,
        P2W_FORMAT_VER_MINOR,
        PACC2W_MAGIC,
    },
    serde::{
        Deserialize,
        Serialize,
        Serializer,
    },
    std::{
        fmt,
        io::{
            Read,
            Write,
        },
        mem,
    },
};

pub mod accumulators;
pub mod hashers;
pub mod pyth;
pub mod wormhole;

pub(crate) type RawPubkey = [u8; 32];
pub(crate) type Hash = [u8; 32];
pub(crate) type PriceId = RawPubkey;

// TODO:
//  1. decide what will be pulled out into a "pythnet" crate and what needs to remain in here
//      a. be careful of cyclic dependencies
//      b. git submodules?

/*** Dummy Field(s) for now just to test updating the sysvar ***/
pub type Slot = u64;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccumulatorAttestation<P: serde::Serialize> {
    pub accumulator: P,

    #[serde(serialize_with = "use_to_string")]
    pub ring_buffer_idx: u64,
    #[serde(serialize_with = "use_to_string")]
    pub height:          u64,
    // TODO: Go back to UnixTimestamp.
    pub timestamp:       i64,
}

pub type ErrBox = Box<dyn std::error::Error>;

// from pyth-crosschain/wormhole_attester/sdk/rust/src/lib.rs
impl<P: serde::Serialize + for<'a> serde::Deserialize<'a>> AccumulatorAttestation<P> {
    pub fn serialize(&self) -> Result<Vec<u8>, ErrBox> {
        // magic
        let mut buf = PACC2W_MAGIC.to_vec();

        // major_version
        buf.extend_from_slice(&P2W_FORMAT_VER_MAJOR.to_be_bytes()[..]);

        // minor_version
        buf.extend_from_slice(&P2W_FORMAT_VER_MINOR.to_be_bytes()[..]);

        // hdr_size
        buf.extend_from_slice(&P2W_FORMAT_HDR_SIZE.to_be_bytes()[..]);

        // // payload_id
        buf.push(PayloadId::AccumulationAttestation as u8);

        // Header is over. NOTE: If you need to append to the header,
        // make sure that the number of bytes after hdr_size is
        // reflected in the P2W_FORMAT_HDR_SIZE constant.

        let AccumulatorAttestation {
            // accumulator_root: accumulator_root,
            accumulator,
            ring_buffer_idx,
            height,
            timestamp,
        } = self;

        //TODO: decide on pyth-accumulator-over-wormhole serialization format.

        let mut serialized_acc = bincode::serialize(&accumulator).unwrap();

        // TODO: always 32? is u16 enough?
        buf.extend_from_slice(&(serialized_acc.len() as u16).to_be_bytes()[..]);

        buf.append(&mut serialized_acc);
        buf.extend_from_slice(&ring_buffer_idx.to_be_bytes()[..]);
        buf.extend_from_slice(&height.to_be_bytes()[..]);
        buf.extend_from_slice(&timestamp.to_be_bytes()[..]);

        Ok(buf)
    }

    //TODO: update this for accumulator attest
    pub fn deserialize(mut bytes: impl Read) -> Result<Self, ErrBox> {
        let mut magic_vec = vec![0u8; PACC2W_MAGIC.len()];
        bytes.read_exact(magic_vec.as_mut_slice())?;

        if magic_vec.as_slice() != PACC2W_MAGIC {
            return Err(
                format!("Invalid magic {magic_vec:02X?}, expected {PACC2W_MAGIC:02X?}",).into(),
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

        if payload_id_vec[0] != PayloadId::AccumulationAttestation as u8 {
            return Err(format!(
                "Invalid Payload ID {}, expected {}",
                payload_id_vec[0],
                PayloadId::AccumulationAttestation as u8,
            )
            .into());
        }

        // Header consumed, continue with remaining fields
        let mut accum_len_vec = vec![0u8; mem::size_of::<u16>()];
        bytes.read_exact(accum_len_vec.as_mut_slice())?;
        let accum_len = u16::from_be_bytes(accum_len_vec.as_slice().try_into()?);

        // let accum_vec = Vec::with_capacity(accum_len_vec as usize);
        let mut accum_vec = vec![0u8; accum_len as usize];
        bytes.read_exact(accum_vec.as_mut_slice())?;
        let accumulator = match bincode::deserialize(accum_vec.as_slice()) {
            Ok(acc) => acc,
            Err(e) => return Err(format!("AccumulatorDeserialization failed: {e}").into()),
        };

        let mut ring_buff_idx_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(ring_buff_idx_vec.as_mut_slice())?;
        let ring_buffer_idx = u64::from_be_bytes(ring_buff_idx_vec.as_slice().try_into()?);

        let mut height_vec = vec![0u8; mem::size_of::<u64>()];
        bytes.read_exact(height_vec.as_mut_slice())?;
        let height = u64::from_be_bytes(height_vec.as_slice().try_into()?);

        let mut timestamp_vec = vec![0u8; mem::size_of::<i64>()];
        bytes.read_exact(timestamp_vec.as_mut_slice())?;
        let timestamp = i64::from_be_bytes(timestamp_vec.as_slice().try_into()?);

        Ok(Self {
            accumulator,
            ring_buffer_idx,
            height,
            timestamp,
        })
    }
}

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

#[derive(
    Copy,
    Clone,
    Default,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    BorshSerialize,
    BorshDeserialize,
    serde::Serialize,
    serde::Deserialize,
)]
#[repr(C)]
pub struct Identifier(#[serde(with = "hex")] [u8; 32]);

impl Identifier {
    pub fn new(bytes: [u8; 32]) -> Identifier {
        Identifier(bytes)
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    pub fn from_hex<T: AsRef<[u8]>>(s: T) -> Result<Identifier, FromHexError> {
        let mut bytes = [0u8; 32];
        hex::decode_to_slice(s, &mut bytes)?;
        Ok(Identifier::new(bytes))
    }
}

impl fmt::Debug for Identifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{}", self.to_hex())
    }
}

impl fmt::Display for Identifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{}", self.to_hex())
    }
}

impl AsRef<[u8]> for Identifier {
    fn as_ref(&self) -> &[u8] {
        &self.0[..]
    }
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::{
            accumulators::{
                merkle::MerkleAccumulator,
                Accumulator,
            },
            hashers::keccak256::Keccak256Hasher,
            pyth::*,
        },
    };

    pub fn new_unique_pubkey() -> RawPubkey {
        use rand::Rng;
        rand::thread_rng().gen::<[u8; 32]>()
    }

    impl AccountHeader {
        fn new(account_type: u32) -> Self {
            Self {
                account_type,
                ..AccountHeader::default()
            }
        }
    }

    fn generate_price_account(price: i64) -> (RawPubkey, PriceAccount) {
        (
            new_unique_pubkey(),
            PriceAccount {
                price_type: 0,
                header: AccountHeader::new(PC_ACCTYPE_PRICE),
                agg_: PriceInfo {
                    price_: price,
                    ..PriceInfo::default()
                },
                ..PriceAccount::default()
            },
        )
    }

    #[test]
    fn test_pa_default() {
        println!("testing pa");
        let acct_header = AccountHeader::default();
        println!("acct_header.acct_type: {}", acct_header.account_type);
        let pa = PriceAccount::default();
        println!("price_account.price_type: {}", pa.price_type);
    }

    #[test]
    fn test_new_accumulator() {
        let price_accts_and_keys = (0..2)
            .map(|i| generate_price_account(i * 2))
            .collect::<Vec<_>>();
        let set = price_accts_and_keys
            .iter()
            .map(|(_, pa)| bytemuck::bytes_of(pa))
            .collect::<Vec<_>>();
        let accumulator = MerkleAccumulator::<'_, Keccak256Hasher>::from_set(set.iter()).unwrap();

        println!("acc: {:#?}", accumulator.accumulator.get_root());
    }
}

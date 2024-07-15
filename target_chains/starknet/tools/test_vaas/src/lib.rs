use std::{
    fmt::Display,
    io::{Cursor, Seek, SeekFrom},
};

use alloy_primitives::FixedBytes;
use byteorder::{ReadBytesExt, WriteBytesExt, BE};
use libsecp256k1::{sign, Message, PublicKey, SecretKey};
use primitive_types::U256;
use wormhole_vaas::{keccak256, GuardianSetSig, Readable, Vaa, VaaBody, VaaHeader, Writeable};

/// A data format compatible with `pyth::byte_buffer::ByteBuffer`.
struct CairoByteBufferData {
    // Number of bytes stored in the last item of `self.data` (or 0 if it's empty).
    num_last_bytes: usize,
    // Bytes in big endian. Each item except the last one stores 31 bytes.
    // If `num_last_bytes < 31`, unused most significant bytes of the last item must be unset.
    data: Vec<U256>,
}

/// Converts bytes into a format compatible with `pyth::byte_buffer::ByteBuffer`.
fn to_cairo_byte_array_data(data: &[u8]) -> CairoByteBufferData {
    let mut pos = 0;
    let mut r = Vec::new();
    while pos < data.len() {
        if pos + 31 <= data.len() {
            let mut buf = [0u8; 32];
            buf[1..].copy_from_slice(&data[pos..pos + 31]);
            r.push(U256::from_big_endian(&buf));
        } else {
            let mut buf = [0u8; 32];
            let len = data.len() - pos;
            buf[32 - len..].copy_from_slice(&data[pos..]);
            r.push(U256::from_big_endian(&buf));
            return CairoByteBufferData {
                num_last_bytes: len,
                data: r,
            };
        }
        pos += 31;
    }
    CairoByteBufferData {
        num_last_bytes: if r.is_empty() { 0 } else { 31 },
        data: r,
    }
}

/// Print data in the format compatible with `starkli invoke` or `starkli call`.
pub fn print_as_cli_input(data: &[u8]) {
    let data = to_cairo_byte_array_data(data);
    print!("{} {} ", data.num_last_bytes, data.data.len());
    for item in data.data {
        print!("{item} ");
    }
    println!();
}

/// Print data in the format suitable for embedding in tests.
pub fn print_as_cairo_fn(data: &[u8], name: impl Display, comment: impl Display) {
    println!();
    println!("// {comment}");
    let data = to_cairo_byte_array_data(data);
    println!("pub fn {name}() -> ByteBuffer {{");
    println!("    let bytes = array![");
    for item in data.data {
        println!("        {item},");
    }
    println!("    ];");
    println!("    ByteBufferImpl::new(bytes, {})", data.num_last_bytes);
    println!("}}");
}

pub struct GuardianSet {
    pub set_index: u32,
    pub secrets: Vec<SecretKey>,
}

impl GuardianSet {
    pub fn sign_vaa(&self, indexes: &[usize], body: VaaBody) -> Vaa {
        const VERSION: u8 = 1;

        let mut data = Vec::new();
        body.write(&mut data).unwrap();
        let double_hash = keccak256(keccak256(&data));
        let message = Message::parse_slice(&*double_hash).unwrap();

        let mut signatures = Vec::new();
        for &index in indexes {
            let (signature, recovery_key) = sign(&message, &self.secrets[index]);
            let mut signature_bytes = signature.serialize().to_vec();
            signature_bytes.push(recovery_key.serialize());
            signatures.push(GuardianSetSig {
                guardian_set_index: index.try_into().unwrap(),
                signature: FixedBytes::from_slice(&signature_bytes),
            });
        }
        Vaa {
            header: VaaHeader {
                version: VERSION,
                guardian_set_index: self.set_index,
                signatures,
            },
            body,
        }
    }
}

pub fn eth_address(public_key: &PublicKey) -> EthAddress {
    let hash = keccak256(&public_key.serialize()[1..]);
    EthAddress(hash[hash.len() - 20..].to_vec())
}

pub struct GuardianSetUpgrade {
    pub chain_id: u16,
    pub set_index: u32,
    pub guardians: Vec<EthAddress>,
}

pub fn u256_to_be(value: U256) -> [u8; 32] {
    let mut buf = [0; 32];
    value.to_big_endian(&mut buf);
    buf
}

impl GuardianSetUpgrade {
    pub fn serialize(&self) -> Vec<u8> {
        let mut payload = Vec::new();
        payload.extend_from_slice(&u256_to_be(0x436f7265.into())); // module
        payload.push(2); // action
        payload.write_u16::<BE>(self.chain_id).unwrap();
        payload.write_u32::<BE>(self.set_index).unwrap();
        payload.push(self.guardians.len().try_into().unwrap());
        for guardian in &self.guardians {
            payload.extend_from_slice(&guardian.0);
        }
        payload
    }
}

pub fn serialize_vaa(vaa: Vaa) -> Vec<u8> {
    let mut vaa_bytes = Vec::new();
    vaa.write(&mut vaa_bytes).unwrap();
    vaa_bytes
}

#[derive(Debug, Clone)]
pub struct EthAddress(pub Vec<u8>);

pub struct DataSource {
    pub emitter_chain_id: u16,
    pub emitter_address: FixedBytes<32>,
}

pub struct VaaIndexes {
    pub pos_before_vaa_size: usize,
    pub pos_before_vaa: usize,
    pub pos_after_vaa: usize,
}

pub fn locate_vaa_in_price_update(update: &[u8]) -> VaaIndexes {
    let mut reader = Cursor::new(update);
    reader.seek(SeekFrom::Current(6)).unwrap();
    let trailing_header_len = reader.read_u8().unwrap();
    reader
        .seek(SeekFrom::Current(trailing_header_len.into()))
        .unwrap();
    reader.seek(SeekFrom::Current(1)).unwrap();

    let pos_before_vaa_size: usize = reader.position().try_into().unwrap();
    let wh_proof_size: usize = reader.read_u16::<BE>().unwrap().into();
    let pos_before_vaa: usize = reader.position().try_into().unwrap();
    let pos_after_vaa = pos_before_vaa + wh_proof_size;
    VaaIndexes {
        pos_before_vaa_size,
        pos_before_vaa,
        pos_after_vaa,
    }
}

pub fn re_sign_price_update(
    update: &[u8],
    guardian_set: &GuardianSet,
    new_emitter: Option<DataSource>,
) -> Vec<u8> {
    let VaaIndexes {
        pos_before_vaa_size,
        pos_before_vaa,
        pos_after_vaa,
    } = locate_vaa_in_price_update(update);

    let mut vaa = Vaa::read(&mut Cursor::new(&update[pos_before_vaa..pos_after_vaa])).unwrap();
    if let Some(new_emitter) = new_emitter {
        vaa.body.emitter_chain = new_emitter.emitter_chain_id;
        vaa.body.emitter_address = new_emitter.emitter_address;
    }
    let new_vaa = serialize_vaa(guardian_set.sign_vaa(&[0], vaa.body));
    let mut new_update = update[..pos_before_vaa_size].to_vec();
    new_update.extend_from_slice(&u16::try_from(new_vaa.len()).unwrap().to_be_bytes());
    new_update.extend_from_slice(&new_vaa);
    new_update.extend_from_slice(&update[pos_after_vaa..]);
    new_update
}

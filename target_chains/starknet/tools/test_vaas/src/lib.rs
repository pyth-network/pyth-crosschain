use alloy_primitives::FixedBytes;
use byteorder::{WriteBytesExt, BE};
use libsecp256k1::{sign, Message, PublicKey, SecretKey};
use primitive_types::U256;
use wormhole_vaas::{keccak256, GuardianSetSig, Vaa, VaaBody, VaaHeader, Writeable};

/// A data format compatible with `pyth::byte_array::ByteArray`.
struct CairoByteArrayData {
    // Number of bytes stored in the last item of `self.data` (or 0 if it's empty).
    num_last_bytes: usize,
    // Bytes in big endian. Each item except the last one stores 31 bytes.
    // If `num_last_bytes < 31`, unused most significant bytes of the last item must be unset.
    data: Vec<U256>,
}

/// Converts bytes into a format compatible with `pyth::byte_array::ByteArray`.
fn to_cairo_byte_array_data(data: &[u8]) -> CairoByteArrayData {
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
            return CairoByteArrayData {
                num_last_bytes: len,
                data: r,
            };
        }
        pos += 31;
    }
    CairoByteArrayData {
        num_last_bytes: 0,
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
pub fn print_as_array_and_last(data: &[u8]) {
    let data = to_cairo_byte_array_data(data);
    println!("let bytes = array![");
    for item in data.data {
        println!("    {item},");
    }
    println!("];");
    println!("let last = {};", data.num_last_bytes);
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

pub struct EthAddress(pub Vec<u8>);

use libsecp256k1::{PublicKey, SecretKey};
use rand::rngs::OsRng;
use test_vaas::eth_address;

fn main() {
    let secret_key = SecretKey::random(&mut OsRng);
    let public_key = PublicKey::from_secret_key(&secret_key);
    let eth_address = eth_address(&public_key);
    println!("secret: {}", hex::encode(secret_key.serialize()));
    println!("address: 0x{}", hex::encode(eth_address.0));
}

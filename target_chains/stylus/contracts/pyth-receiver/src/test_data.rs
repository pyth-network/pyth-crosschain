#[cfg(test)]
use alloy_primitives::{address, Address, FixedBytes, I32, I64, U64};
use hex::FromHex;
use std::vec;

#[cfg(test)]
pub fn ban_usd_feed_id() -> [u8; 32] {
    let hex_string = "a6320c8329924601f4d092dd3f562376f657fa0b5d0cba9e4385a24aaf135384";
    let bytes_vec = hex::decode(hex_string).expect("Invalid hex string");

    let byte_array: [u8; 32] = bytes_vec
        .try_into()
        .expect("Hex string must decode to exactly 32 bytes");
    byte_array
}

#[cfg(test)]
pub fn ban_usd_update() -> Vec<Vec<u8>> {
    let hex_str = "504e41550100000003b801000000040d01c9e767c1685410aa1ad3a221af6d257b01d98301b27b72e78f3d7a8d580a90127451c5c699cbb1ef0b5bfd57645456c2898a997ccd4de6eb79d277ce56a12d0b01027599b2f2450d4d59904dc8f738dd73825db0b5235707b9f44119a84e8632c460652e5d7b3ba142120f2510374a478bd7e5cd71b954cae9ef6ea15d7a08a1c3e90103f3a1bd74938fa7c6b2c917303a002474a5f716501c19789fece2a3f80bd05c457c8087a8b2d14e84762059daa5608e38e4e3e8ed572787a20100b8c1d69777f30104c5640a58148caeab59ed9dcc025f7b7dcdeecbfc51108cc29d3659e8b0a1c1aa4079f43e0e846ed353d45b5f436431096cd3094c2fa15e4920e2d35e33632e00010693790cbfaca431837658775a3b274c05676b272b916245f939e978789874ce0f2daa426325986f38c2ee3b9053008362b60b9851d2e9db69d718faddb96db68700098eafe76c684d04f99292d536de3e95eb446c3fac2f70aaac11d5dbda0b5a38f516b56e9f3472528b675337746653c59ed2eae9079ae7f59c004a8cbb40139a7a010ae14fce0cc71f738ec21e66edcd867db036cd5e11a9476c710d2457e025c035c84518c8750b17197d308b9faa2561ec6532c2266eb36723a9d11871b04e3b1138000ba68cde478a18ebbc8e9c2b4bbb4ff16803d5402efbdc9fc34cad9d9ed6f1609f6c81596fac2eed2b98ce6f5b5d7efba530c8b9c15c70f2f10898b38ea2f9978c000d2ecb926686379023572b64d78aef7f61e9aa3e4ceae1d2b2917c1fae6d112b3d7ad1597e6768fffa2dff61a62012562eb68a7cf5597e9bfe755c280df36aef2c000e293c5cb9c805665057bedcfeae74139f47cb5cddc4d5190bbddc4d12cd53caa972281394ac02759b860382da06e8d9b003285090a6783de21786dfcb3b669c58000f3b90618d7a63cdd7da9e730dbd0bf5b22acdc35c08a17c9a6728b1115e63ff837c3267452dc29d8f77fa0cd39428066ea8ae1fd086293e2f17b9421b59f7922f0010629f08a3a59d8187eefef92a54b9bf55fb676f4e9fea826ffb4aa3331155c2162315bd092dd01776f0e45c5d857f9de70a0cbfa9b33f96d8c752bed5c37cf05600113038bf5593427383bfd0966064dc43f7a84f8c083c1bc1b03aa24fc857008f057778ca2393ac1146bbb51588f4903f0822cb94ac0dce7cdcba3a207969d529d000687028bf00000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71000000000897d17f014155575600000000000da5600300002710bb2be176a294375c4430a694c2813c5823a56bef01005500a6320c8329924601f4d092dd3f562376f657fa0b5d0cba9e4385a24aaf1353840000000000625bef0000000000003c63fffffff800000000687028bf00000000687028bf00000000006223710000000000003c6b0c299b70feaac0e02b6430892ee820e1a0706a4099acf41781c8fa57ba6ca1f0b62d98994ccecb7d465eeae1c5a236df5ea50768f1d8e9300500a8824e608c5a02572ee89aa0f0490bd64d60482516a17a2cf6ef3140ac5e35e3ee1844aeb2fb2ab7740ed0905f80725663f8a7018025ea163ece851177137f0e1012b32a540bbaedd2be2b7ecbb6d7baa37298d5ea1e7d8b6c3e3f3c40ec0cdc546dcac1fc8fd0f16828f8d3d948e4ab67391bbca60a63de48273df382ca02f05bd3aa8a0f7513f2a722bd447d8c07a02e73f14d9bb625e82aea434b9378ffba62dd0ef4d04875b1a31cc077b7a9c58ddd0109e4b67e45";
    let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");
    vec![bytes]
}

#[cfg(test)]
pub fn ban_usd_results_full() -> (FixedBytes<32>, U64, I32, I64, U64, I64, U64) {
    (
        FixedBytes::<32>::from(ban_usd_feed_id()),
        U64::from(1752180927u64),
        I32::from_le_bytes((-8i32).to_le_bytes()),
        I64::from_le_bytes(6446063i64.to_le_bytes()),
        U64::from(15459u64),
        I64::from_le_bytes(6431601i64.to_le_bytes()),
        U64::from(15467u64),
    )
}

#[cfg(test)]
pub fn ban_usd_results_get_price() -> (I64, U64, I32, U64) {
    (
        I64::from_le_bytes(6446063i64.to_le_bytes()),
        U64::from(15459u64),
        I32::from_le_bytes((-8i32).to_le_bytes()),
        U64::from(1752180927u64),
    )
}

#[cfg(test)]
pub fn btc_usd_feed_id() -> [u8; 32] {
    let hex_string = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    let bytes_vec = hex::decode(hex_string).expect("Invalid hex string");

    let byte_array: [u8; 32] = bytes_vec
        .try_into()
        .expect("Hex string must decode to exactly 32 bytes");
    byte_array
}

#[cfg(test)]
pub fn btc_usd_update() -> Vec<Vec<u8>> {
    let hex_str = "504e41550100000003b801000000040d0239cafe615bc0f6037d0b2b596490a0473b07ed176082e6645c773678bafd705a3d3e86a03b17c44a9d0e2429051756514c2a247f9d08767b0bf093dd8313814c0103f5be04233a4e4f169428ee7c7e153978c593db55b9fc93ef6329333671eea8c567c143e88300ef470aeb7c3f5fc3d63582fe4c9f28fc451915f0c0a5ac1920f60104883322c38070deaaa013d45ffc4aa111a070938aaed1edda6853fa3676e7fbda6ffcd6711ac4fbb9e9c0320d193b9aace0b1fc42f0060c8ab54024c8cca55e5101066624f81e56e2981619eca215e07e2e055088a2c163dd457bf7d60828b0bc93a27c359999832a0d0534642defc8197b55ffcf1d52b9fcf5a8cee3e73c2910107a01081a8e5f8715f6128642bb34204c08415f972fed334add518e672be983f4e3830b7cdfb653976a37421a86d3ea1d0b5ee2d2baa8c54309539e4e7e64d57f13816d010a0df0714ee3e9d8f741c15b50f2d2b5a80bdfbdcd62963d37efde7690ee2f35ac4a134f425ec84610decb606254c81813d3be6372e64bf7d8692c1ceb7d3dbf31000bdbdfb38a07d2efd68bc96caeb986ab39473d5080575a0f7878bfbd4456da0df25dfad1e45c30bc1eb2d81922a5355db6fbc109b9bf4520f18b2da9cbd06c1b9d010ca5a2450d2339debfb36065567196c340721e260ea524003b2e73ef3f9ed1f9d2446e8b059c91ff124e83156e826c6cb496125ef6f54a578d03de9ce7a488a4f1010d2f389063583770fef355929ec57015b9b7f4d5879f63bc1dd1e8a1605b12cfbf534fb31d56be4e54ae1eba9442045b791b0cc9b56d3e3b0b4e8952c98841bed3000e343679701f31206503ee1014842cffdd7fb6b05173d8373e9fa99bd3a1f075a77339f1a588766d716cf650b7f04c6ec38b4f146932ab19345a5b976beb7fb932010ff8ecf6e31a7588184df483d4db07875c06c009f2837e8402fd5e72fc703317f5284be8d9354b4fab80397828dcee6e8d42e384bc0900e6c09bf03d062449d79b0010804e0a59b1ceaa6b27686390cf012f9b28c3f0631d625a02c2aa61924ae9e3f750d408ba01469ceba5c69750562a8764bf3f395fb2d3651ef7e785880dbf9f6d0011d624fbfc51b33be04143af0df857bff085ec613ce45c0afac19cb7b25d1386d4748a757c1d88c084a5917c0fa29e62777f52627100f9371e17b9cf3d7761e74c006870299c00000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71000000000897d392014155575600000000000da562160000271079aec689f7474fccda868e2c953a8034004c18f001005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b4300000a555e80406d00000000d970a713fffffff8000000006870299c000000006870299b00000a51d33b2f20000000010aa6a7740c9ed309739de34ae90fbadd4e31dfb63bdf4e6ce18be268a0b475c9fa239b3b3dc6413e6be59d3e081d18340d5f54f7c775bb8a3624c9b6365c377be3c7d8d95148bbeef8ed7337083c85b99f3d24fceef013b441f91efaf0d75d3054c798046ed109da12b59b60043a81139983cf1c68705c58279e7b3f122ff0562c5e8b925d8ebd8791842efc74260de6917967faea7c994b1bd8791cce3129f877447db2fe0e5436384e4e2dd7facc50127c072a25f69aad5d3c89ed0f38cb6b792c0d12c123f76b7059e9217b959969ba558430b06a4aeb769fd7a1a8cf3eb74680f0bc1b84882fb8e311d3db94ea051d2e209f6b";
    let bytes = Vec::from_hex(hex_str).expect("Invalid hex string");
    vec![bytes]
}

#[cfg(test)]
pub fn btc_usd_results_full() -> (FixedBytes<32>, U64, I32, I64, U64, I64, U64) {
    (
        FixedBytes::<32>::from(btc_usd_feed_id()),
        U64::from(1752181148u64),
        I32::from_le_bytes((-8i32).to_le_bytes()),
        I64::from_le_bytes(11361773961325i64.to_le_bytes()),
        U64::from(3648038675u64),
        I64::from_le_bytes(11346552500000i64.to_le_bytes()),
        U64::from(4473661300u64),
    )
}

#[cfg(test)]
pub fn btc_usd_results_get_price() -> (I64, U64, I32, U64) {
    (
        I64::from_le_bytes(11361773961325i64.to_le_bytes()),
        U64::from(3648038675u64),
        I32::from_le_bytes((-8i32).to_le_bytes()),
        U64::from(1752181148u64),
    )
}

#[cfg(test)]
pub fn multiple_updates_diff_vaa() -> Vec<Vec<u8>> {
    vec![ban_usd_update()[0].clone(), btc_usd_update()[0].clone()]
}

#[cfg(test)]
pub fn multiple_updates_diff_vaa_results_full(
) -> [(FixedBytes<32>, U64, I32, I64, U64, I64, U64); 2] {
    [ban_usd_results_full(), btc_usd_results_full()]
}

#[cfg(test)]
pub fn multiple_updates_diff_vaa_results_get_price() -> [(I64, U64, I32, U64); 2] {
    [ban_usd_results_get_price(), btc_usd_results_get_price()]
}

#[cfg(test)]
pub fn current_guardians() -> Vec<Address> {
    vec![
        address!("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"), // Rockaway
        address!("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"), // Staked
        address!("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"), // Figment
        address!("0x107A0086b32d7A0977926A205131d8731D39cbEB"), // ChainodeTech
        address!("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"), // Inotel
        address!("0x11b39756C042441BE6D8650b69b54EbE715E2343"), // HashKey Cloud
        address!("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"), // ChainLayer
        address!("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"), // xLabs
        address!("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"), // Forbole
        address!("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"), // Staking Fund
        address!("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"), // Moonlet Wallet
        address!("0xf93124b7c738843CBB89E864c862c38cddCccF95"), // P2P Validator
        address!("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"), // 01node
        address!("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"), // MCF
        address!("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"), // Everstake
        address!("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"), // Chorus One
        address!("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"), // Syncnode
        address!("0x5E1487F35515d02A92753504a8D75471b9f49EdB"), // Triton
        address!("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"), // Staking Facilities
    ]
}

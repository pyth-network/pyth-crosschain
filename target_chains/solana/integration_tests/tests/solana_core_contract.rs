//! Integration test for the Pyth Solana Receiver program.
//!
//! This test exercises the full end-to-end flow of posting a Pyth price update
//! on a local SVM (LiteSVM), using real mainnet guardian sets and live Hermes
//! price data.
//!
//! Prerequisites:
//! - The pyth_solana_receiver and pyth_push_oracle programs must be built via
//!   `cargo build-sbf` before running this test.
//! - Network access is required for the Hermes API call.

use {
    borsh::{BorshDeserialize, BorshSerialize},
    litesvm::LiteSVM,
    pythnet_sdk::wire::v1::{AccumulatorUpdateData, MerklePriceUpdate, Proof},
    sha2::{Digest, Sha256},
    solana_sdk::{
        account::Account,
        compute_budget::ComputeBudgetInstruction,
        instruction::{AccountMeta, Instruction},
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
        rent::Rent,
        signature::Keypair,
        signer::Signer,
        system_program,
        transaction::Transaction,
    },
    std::str::FromStr,
};

// ---------------------------------------------------------------------------
// Program IDs
// ---------------------------------------------------------------------------

/// Wormhole core bridge on mainnet Solana.
const WORMHOLE_PROGRAM_ID: &str = "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ";
/// Pyth Solana Receiver program.
const PYTH_RECEIVER_ID: &str = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
/// Pyth Push Oracle program (needed by pyth receiver).
const PYTH_PUSH_ORACLE_ID: &str = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";

// ---------------------------------------------------------------------------
// Seeds & constants
// ---------------------------------------------------------------------------

const GUARDIAN_SET_SEED: &[u8] = b"GuardianSet";
const CONFIG_SEED: &[u8] = b"config";
const TREASURY_SEED: &[u8] = b"treasury";

// ---------------------------------------------------------------------------
// Mainnet guardian data (from cli/src/main.rs)
// ---------------------------------------------------------------------------

const INITIAL_GUARDIAN: &str = "58cc3ae5c097b213ce3c81979e1b9f9570746aa5";

const UPGRADE_GUARDIAN_SET_VAA_1 : &str = "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_2 : &str = "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_3 : &str = "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe70811d1f64e26238811de5553c40f64af41ee1b6057cc43ac8f567a31e7850da532b361988bfe0d3ae11b178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_4 : &str = "01000000030d03d4a37a6ff4361d91714730831e9d49785f61624c8f348a9c6c1d82bc1d98cadc5e936338204445c6250bb4928f3f3e165ad47ca03a5d63111168a2de4576856301049a5df10464ea4e1961589fd30fc18d1970a7a2ffaad617e56a0f7777f25275253af7d10a0f0f2494dc6e99fc80e444ab9ebbbee252ded2d5dcb50cbf7a54bb5a01055f4603b553b9ba9e224f9c55c7bca3da00abb10abd19e0081aecd3b352be061a70f79f5f388ebe5190838ef3cd13a2f22459c9a94206883b739c90b40d5d74640006a8fade3997f650a36e46bceb1f609edff201ab32362266f166c5c7da713f6a19590c20b68ed3f0119cb24813c727560ede086b3d610c2d7a1efa66f655bad90900080f5e495a75ea52241c59d145c616bfac01e57182ad8d784cbcc9862ed3afb60c0983ccbc690553961ffcf115a0c917367daada8e60be2cbb8b8008bac6341a8c010935ab11e0eea28b87a1edc5ccce3f1fac25f75b5f640fe6b0673a7cd74513c9dc01c544216cf364cc9993b09fda612e0cd1ced9c00fb668b872a16a64ebb55d27010ab2bc39617a2396e7defa24cd7c22f42dc31f3c42ffcd9d1472b02df8468a4d0563911e8fb6a4b5b0ce0bd505daa53779b08ff660967b31f246126ed7f6f29a7e000bdb6d3fd7b33bdc9ac3992916eb4aacb97e7e21d19649e7fa28d2dd6e337937e4274516a96c13ac7a8895da9f91948ea3a09c25f44b982c62ce8842b58e20c8a9000d3d1b19c8bb000856b6610b9d28abde6c35cb7705c6ca5db711f7be96d60eed9d72cfa402a6bfe8bf0496dbc7af35796fc768da51a067b95941b3712dce8ae1e7010ec80085033157fd1a5628fc0c56267469a86f0e5a66d7dede1ad4ce74ecc3dff95b60307a39c3bfbeedc915075070da30d0395def9635130584f709b3885e1bdc0010fc480eb9ee715a2d151b23722b48b42581d7f4001fc1696c75425040bfc1ffc5394fe418adb2b64bd3dc692efda4cc408163677dbe233b16bcdabb853a20843301118ee9e115e1a0c981f19d0772b850e666591322da742a9a12cce9f52a5665bd474abdd59c580016bee8aae67fdf39b315be2528d12eec3a652910e03cc4c6fa3801129d0d1e2e429e969918ec163d16a7a5b2c6729aa44af5dccad07d25d19891556a79b574f42d9adbd9e2a9ae5a6b8750331d2fccb328dd94c3bf8791ee1bfe85aa00661e99781981faea00010000000000000000000000000000000000000000000000000000000000000004fd4c6c55ec8dfd342000000000000000000000000000000000000000000000000000000000436f726502000000000004135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_5 : &str = "01000000040d00ada3cbcc53ec9abef64822eb3bf61784a1cf36dd7975a6f1fa793dfd35cd5b865b0b8daf6e7eec309d870423c5a5b7898cd56933ca82c824941d932766a014a70001b7731ff820ad5b3f97972428a81c8c8b1c55a42e8ae55f46a95ee7423fd4074b3f03c609cfff926a096fe642a1c939d7946972e1bea2bce02b40b766eb5b23e1010321738f8fb68652f1bb485b171badc3b0d347ad3cbcdc95aad0119020a5f1d46d1d9d92fd423a345b0f2ab2a722a25cace96acca0d1c4f2c839285ed06a6f0fb20104e67cedf1d48251817accb73647b0d16e1d565d1951baf62b1654b0bb26d516992df131dfdefcc499a41b7a49dead0cb03498ef6108018d88ab5c80397a83432401057f6a06e6d10f5d6cd84b552e866abc58c9899bb2a68956eaafca5988c19e8fc979a1d530636f1f897fb039d108d0b7fd4fde8679f75244cf3e10ffd1f605190c010675dac57d998d88ea80ad7078b6bf88d73abe8ed2ca960a17736c9a7dbfa168fa1c843b7e43883a0a15d0884bf2a397acacef142da51eec01bac331bd6e3aeb160008391dc0b9eed3fadc57528f2c32a6a060833aced6d617b95d39ea00300ca3e15951b175d1da741d31293d3bbedd1826d708675feb3bce56c58535592cdd4a5592000a8f30bde711c2d2b7e7f453be7a42b8da724008a34597c329c3989ecdd4f368f50d61b7b8c4c7d9f46e28334c4185d03284d90552b1f98cf0cd82c63fb5ecab63000cf67fb4e05463c3982a2379d1f779ad4364ba6ca5b240de82af4affc4c6ee58a52a972e21bbb254f15a4ea74cb511e32f06c021d9e774b34526e681dfa3537593000ea13cf78e719c7238fceb16f6fa1eb08de4c516b3e4c491b63382fdf3df5199543183c1ca67625178fb341484f58a18379bad73625637f0b64bae6b676b89033d000f8e4cfb95d01f4f84bf249038f64c10fb2d94f3a0429b01f853665deeebeae5e47e9d93926c97e1925b4be373e6ef96a606bc032b27a1bbcef95caa5c4f24dea0011111a9fc56e090fb01a739611ca9fd3de40ec53eeeb833e2b4fbab2dfdc176d60c734532248f2b2e5e0fbee8408245a8ca5d57440c6d596e981ade750a6e17928a011296e2fd4197141394987d06218f7b99b709adfb9e0511a177f9bfde8e7fbe1d4b55b9e4c2af3a70d2f73d6df12c3a60e6a677d476ff4393b9779f2735dbcd36e80169b6aee4a49c205b00010000000000000000000000000000000000000000000000000000000000000004fcdad9b63b91b4422000000000000000000000000000000000000000000000000000000000436f726502000000000005135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e2343938f104aeb5581293216ce97d771e0cb721221b115e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe70811d1f64e26238811de5553c40f64af41ee1b6057cc43ac8f567a31e7850da532b361988bfe0d3ae11b178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

// ---------------------------------------------------------------------------
// Hermes API
// ---------------------------------------------------------------------------

/// ETH/USD price feed ID.
const ETH_USD_FEED_ID: &str = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const HERMES_URL: &str = "https://hermes.pyth.network/v2/updates/price/latest";

// ---------------------------------------------------------------------------
// Local type definitions matching on-chain borsh layouts
// ---------------------------------------------------------------------------

/// Matches pyth_solana_receiver_sdk::config::Config borsh layout.
#[derive(BorshSerialize)]
struct Config {
    governance_authority: Pubkey,
    target_governance_authority: Option<Pubkey>,
    wormhole: Pubkey,
    valid_data_sources: Vec<DataSource>,
    single_update_fee_in_lamports: u64,
    minimum_signatures: u8,
}

/// Matches pyth_solana_receiver_sdk::config::DataSource borsh layout.
#[derive(BorshSerialize)]
struct DataSource {
    chain: u16,
    emitter: Pubkey,
}

/// Matches pyth_solana_receiver_sdk::PostUpdateAtomicParams borsh layout.
#[derive(BorshSerialize)]
struct PostUpdateAtomicParams {
    vaa: Vec<u8>,
    merkle_price_update: MerklePriceUpdate,
    treasury_id: u8,
}

/// Matches wormhole_core_bridge_solana::state::GuardianSet borsh layout.
#[derive(BorshSerialize, BorshDeserialize)]
struct GuardianSetData {
    index: u32,
    keys: Vec<[u8; 20]>,
    creation_time: u32,
    expiration_time: u32,
}

/// Minimal deserialization of PriceUpdateV2 to verify the posted price.
#[derive(BorshDeserialize, Debug)]
struct PriceUpdateV2 {
    write_authority: Pubkey,
    verification_level: VerificationLevel,
    price_message: PriceFeedMessage,
    posted_slot: u64,
}

#[derive(BorshDeserialize, Debug)]
#[allow(dead_code)]
enum VerificationLevel {
    Partial { num_signatures: u8 },
    Full,
}

#[derive(BorshDeserialize, Debug)]
#[allow(dead_code)]
struct PriceFeedMessage {
    feed_id: [u8; 32],
    price: i64,
    conf: u64,
    exponent: i32,
    publish_time: i64,
    prev_publish_time: i64,
    ema_price: i64,
    ema_conf: u64,
}

/// Hermes API JSON response structure.
#[derive(serde::Deserialize)]
struct HermesResponse {
    binary: HermesBinaryData,
}

#[derive(serde::Deserialize)]
struct HermesBinaryData {
    data: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Compute the 8-byte Anchor instruction discriminator.
fn anchor_instruction_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

/// Compute the 8-byte Anchor account discriminator.
fn anchor_account_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("account:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

/// Derive the guardian set PDA address.
fn get_guardian_set_address(wormhole: &Pubkey, index: u32) -> Pubkey {
    Pubkey::find_program_address(&[GUARDIAN_SET_SEED, &index.to_be_bytes()], wormhole).0
}

/// Derive the pyth receiver config PDA address.
fn get_config_address(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], program_id).0
}

/// Derive a treasury PDA address.
fn get_treasury_address(program_id: &Pubkey, treasury_id: u8) -> Pubkey {
    Pubkey::find_program_address(&[TREASURY_SEED, &[treasury_id]], program_id).0
}

/// Parse a wormhole VAA binary to extract the guardian_set_index (bytes 1..5, big-endian).
fn vaa_guardian_set_index(vaa: &[u8]) -> u32 {
    u32::from_be_bytes([vaa[1], vaa[2], vaa[3], vaa[4]])
}

/// Parse a wormhole VAA binary to extract emitter_chain and emitter_address from the body.
fn vaa_emitter_info(vaa: &[u8]) -> (u16, [u8; 32]) {
    let num_signatures = vaa[5] as usize;
    let body_offset = 6 + num_signatures * 66;
    // body layout: timestamp(4) + nonce(4) + emitter_chain(2) + emitter_address(32) + ...
    let emitter_chain = u16::from_be_bytes([vaa[body_offset + 8], vaa[body_offset + 9]]);
    let mut emitter_address = [0u8; 32];
    emitter_address.copy_from_slice(&vaa[body_offset + 10..body_offset + 42]);
    (emitter_chain, emitter_address)
}

/// Parse guardian keys from a guardian-set-upgrade VAA payload.
///
/// The VAA body payload for a guardian set upgrade has:
///   32 bytes: module ("Core" padded)
///   1 byte:   action (2 = GuardianSetUpgrade)
///   2 bytes:  chain (0 = all)
///   4 bytes:  new_guardian_set_index (big-endian)
///   1 byte:   num_guardians
///   20 * N:   guardian keys
fn parse_guardian_keys_from_upgrade_vaa(vaa_hex: &str) -> (u32, Vec<[u8; 20]>) {
    let vaa_bytes = hex::decode(vaa_hex).unwrap();
    let num_signatures = vaa_bytes[5] as usize;
    let body_offset = 6 + num_signatures * 66;
    // body: timestamp(4) + nonce(4) + emitter_chain(2) + emitter_address(32) + sequence(8) + consistency_level(1) = 51 bytes before payload
    let payload_offset = body_offset + 51;
    let payload = &vaa_bytes[payload_offset..];

    // Skip module(32) + action(1) + chain(2) = 35 bytes
    let index_offset = 35;
    let new_index = u32::from_be_bytes([
        payload[index_offset],
        payload[index_offset + 1],
        payload[index_offset + 2],
        payload[index_offset + 3],
    ]);
    let num_guardians = payload[index_offset + 4] as usize;
    let keys_offset = index_offset + 5;

    let mut keys = Vec::with_capacity(num_guardians);
    for i in 0..num_guardians {
        let start = keys_offset + i * 20;
        let mut key = [0u8; 20];
        key.copy_from_slice(&payload[start..start + 20]);
        keys.push(key);
    }
    (new_index, keys)
}

/// Build all guardian sets (0 through 5) from the hardcoded upgrade VAAs.
fn build_all_guardian_sets() -> Vec<(u32, Vec<[u8; 20]>)> {
    let mut sets = Vec::new();

    // Guardian set 0: single initial guardian
    let initial = hex::decode(INITIAL_GUARDIAN).unwrap();
    let mut key0 = [0u8; 20];
    key0.copy_from_slice(&initial);
    sets.push((0, vec![key0]));

    // Guardian sets 1-5 from upgrade VAAs
    for vaa_hex in [
        UPGRADE_GUARDIAN_SET_VAA_1,
        UPGRADE_GUARDIAN_SET_VAA_2,
        UPGRADE_GUARDIAN_SET_VAA_3,
        UPGRADE_GUARDIAN_SET_VAA_4,
        UPGRADE_GUARDIAN_SET_VAA_5,
    ] {
        sets.push(parse_guardian_keys_from_upgrade_vaa(vaa_hex));
    }

    sets
}

/// Create a guardian set account (Anchor format) as Account.
fn create_guardian_set_account(
    wormhole: &Pubkey,
    index: u32,
    keys: Vec<[u8; 20]>,
) -> (Pubkey, Account) {
    let guardian_set = GuardianSetData {
        index,
        keys,
        creation_time: 0,
        expiration_time: 0, // 0 means never expires
    };

    let discriminator = anchor_account_discriminator("GuardianSet");
    let mut data = Vec::new();
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&guardian_set.try_to_vec().unwrap());

    let pda = get_guardian_set_address(wormhole, index);

    let account = Account {
        lamports: Rent::default().minimum_balance(data.len()),
        data,
        owner: *wormhole,
        executable: false,
        rent_epoch: 0,
    };

    (pda, account)
}

/// Build the Initialize instruction for the pyth receiver program.
fn build_initialize_instruction(
    program_id: &Pubkey,
    payer: &Pubkey,
    config: Config,
) -> Instruction {
    let config_pda = get_config_address(program_id);
    let discriminator = anchor_instruction_discriminator("initialize");

    let mut data = Vec::new();
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&config.try_to_vec().unwrap());

    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(config_pda, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data,
    }
}

/// Build the PostUpdateAtomic instruction.
#[allow(clippy::too_many_arguments)]
fn build_post_update_atomic_instruction(
    program_id: &Pubkey,
    payer: &Pubkey,
    write_authority: &Pubkey,
    price_update_account: &Pubkey,
    wormhole: &Pubkey,
    guardian_set_index: u32,
    vaa: Vec<u8>,
    merkle_price_update: MerklePriceUpdate,
    treasury_id: u8,
) -> Instruction {
    let config_pda = get_config_address(program_id);
    let treasury_pda = get_treasury_address(program_id, treasury_id);
    let guardian_set_pda = get_guardian_set_address(wormhole, guardian_set_index);

    let discriminator = anchor_instruction_discriminator("post_update_atomic");
    let params = PostUpdateAtomicParams {
        vaa,
        merkle_price_update,
        treasury_id,
    };

    let mut data = Vec::new();
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&params.try_to_vec().unwrap());

    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(guardian_set_pda, false),
            AccountMeta::new_readonly(config_pda, false),
            AccountMeta::new(treasury_pda, false),
            AccountMeta::new(*price_update_account, true),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(*write_authority, true),
        ],
        data,
    }
}

/// Fetch the latest ETH/USD price update from the Hermes API.
/// Returns the raw accumulator update bytes.
fn fetch_hermes_price_update() -> Vec<u8> {
    let url = format!("{HERMES_URL}?ids[]={ETH_USD_FEED_ID}&encoding=base64");

    let client = reqwest::blocking::Client::new();
    let resp: HermesResponse = client
        .get(&url)
        .send()
        .expect("failed to fetch from Hermes API")
        .json()
        .expect("failed to parse Hermes response");

    assert!(
        !resp.binary.data.is_empty(),
        "Hermes returned no binary data"
    );

    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(&resp.binary.data[0])
        .expect("failed to base64-decode Hermes data")
}

// ---------------------------------------------------------------------------
// Integration test
// ---------------------------------------------------------------------------

#[test]
fn test_post_price_update_on_local_svm() {
    let wormhole = Pubkey::from_str(WORMHOLE_PROGRAM_ID).unwrap();
    let pyth_receiver = Pubkey::from_str(PYTH_RECEIVER_ID).unwrap();
    let pyth_push_oracle = Pubkey::from_str(PYTH_PUSH_ORACLE_ID).unwrap();

    // -----------------------------------------------------------------------
    // 1. Fetch live price from Hermes
    // -----------------------------------------------------------------------
    println!("Fetching ETH/USD price update from Hermes...");
    let accumulator_bytes = fetch_hermes_price_update();

    // Deserialize the accumulator update data to get the VAA and merkle proofs
    let accumulator_update = AccumulatorUpdateData::try_from_slice(&accumulator_bytes)
        .expect("failed to deserialize accumulator update data");

    let (vaa, merkle_price_updates) = match accumulator_update.proof {
        Proof::WormholeMerkle { vaa, updates } => (Vec::<u8>::from(vaa), updates),
    };

    assert!(
        !merkle_price_updates.is_empty(),
        "no merkle price updates in Hermes response"
    );

    let guardian_set_index = vaa_guardian_set_index(&vaa);
    let (emitter_chain, emitter_address) = vaa_emitter_info(&vaa);
    println!("VAA guardian_set_index={guardian_set_index}, emitter_chain={emitter_chain}");

    // -----------------------------------------------------------------------
    // 2. Build all guardian sets from hardcoded upgrade VAAs
    // -----------------------------------------------------------------------
    let all_guardian_sets = build_all_guardian_sets();
    assert!(
        (guardian_set_index as usize) < all_guardian_sets.len(),
        "VAA references guardian set {guardian_set_index} which is beyond our known sets (0..{})",
        all_guardian_sets.len() - 1
    );

    // -----------------------------------------------------------------------
    // 3. Setup LiteSVM
    // -----------------------------------------------------------------------
    let mut svm = LiteSVM::new();

    // Load pyth-solana-receiver program
    svm.add_program_from_file(pyth_receiver, "../target/deploy/pyth_solana_receiver.so")
        .expect("failed to load pyth_solana_receiver.so — did you run cargo build-sbf?");

    // Load pyth-push-oracle program (required by pyth receiver as CPI target)
    svm.add_program_from_file(pyth_push_oracle, "../target/deploy/pyth_push_oracle.so")
        .expect("failed to load pyth_push_oracle.so — did you run cargo build-sbf?");

    // Fund the payer
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100 * LAMPORTS_PER_SOL)
        .unwrap();

    // -----------------------------------------------------------------------
    // 4. Pre-populate guardian set accounts (sets 0 through 5)
    // -----------------------------------------------------------------------
    println!("Setting up guardian set accounts...");
    for (index, keys) in &all_guardian_sets {
        let (pda, account) = create_guardian_set_account(&wormhole, *index, keys.clone());
        svm.set_account(pda, account).unwrap();
        println!("  Guardian set {index}: {} guardians at {pda}", keys.len());
    }

    // -----------------------------------------------------------------------
    // 5. Initialize Pyth Receiver
    // -----------------------------------------------------------------------
    println!("Initializing Pyth Receiver...");
    let config = Config {
        governance_authority: payer.pubkey(),
        target_governance_authority: None,
        wormhole,
        valid_data_sources: vec![DataSource {
            chain: emitter_chain,
            emitter: Pubkey::from(emitter_address),
        }],
        single_update_fee_in_lamports: 1,
        minimum_signatures: 3,
    };

    let initialize_ix = build_initialize_instruction(&pyth_receiver, &payer.pubkey(), config);
    let tx = Transaction::new_signed_with_payer(
        &[initialize_ix],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx)
        .expect("failed to initialize pyth receiver");

    // -----------------------------------------------------------------------
    // 6. Post price update atomically
    // -----------------------------------------------------------------------
    println!("Posting price update atomically...");
    let price_update_keypair = Keypair::new();
    let treasury_id: u8 = 0;

    let compute_budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(2_000_000);
    let post_update_ix = build_post_update_atomic_instruction(
        &pyth_receiver,
        &payer.pubkey(),
        &payer.pubkey(),
        &price_update_keypair.pubkey(),
        &wormhole,
        guardian_set_index,
        vaa,
        merkle_price_updates[0].clone(),
        treasury_id,
    );

    let tx = Transaction::new_signed_with_payer(
        &[compute_budget_ix, post_update_ix],
        Some(&payer.pubkey()),
        &[&payer, &price_update_keypair],
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx)
        .expect("failed to post price update atomically");

    // -----------------------------------------------------------------------
    // 7. Verify the posted price update
    // -----------------------------------------------------------------------
    println!("Verifying posted price update...");
    let account = svm
        .get_account(&price_update_keypair.pubkey())
        .expect("price update account not found");

    // Skip the 8-byte Anchor discriminator
    let account_data = &account.data;
    assert!(
        account_data.len() > 8,
        "price update account data too small"
    );
    let price_update = PriceUpdateV2::try_from_slice(&account_data[8..])
        .expect("failed to deserialize PriceUpdateV2");

    // Verify write authority
    assert_eq!(
        price_update.write_authority,
        payer.pubkey(),
        "write authority mismatch"
    );

    // Verify price data is valid (non-zero)
    assert_ne!(
        price_update.price_message.price, 0,
        "price should be non-zero"
    );
    assert_ne!(
        price_update.price_message.publish_time, 0,
        "publish_time should be non-zero"
    );
    assert_ne!(
        price_update.posted_slot, 0,
        "posted_slot should be non-zero"
    );

    // Verify the feed ID matches ETH/USD
    let expected_feed_id = hex::decode(&ETH_USD_FEED_ID[2..]).unwrap();
    assert_eq!(
        &price_update.price_message.feed_id[..],
        &expected_feed_id[..],
        "feed_id mismatch"
    );

    println!("SUCCESS!");
    println!("  Feed ID:      {ETH_USD_FEED_ID}");
    println!("  Price:        {}", price_update.price_message.price);
    println!("  Conf:         {}", price_update.price_message.conf);
    println!("  Exponent:     {}", price_update.price_message.exponent);
    println!(
        "  Publish time: {}",
        price_update.price_message.publish_time
    );
    println!("  Verification: {:?}", price_update.verification_level);
}

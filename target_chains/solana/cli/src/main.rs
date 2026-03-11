pub mod cli;

use {
    anchor_client::anchor_lang::{InstructionData, ToAccountMetas},
    anyhow::{anyhow, Context, Result},
    borsh::BorshDeserialize,
    clap::Parser,
    cli::{Action, Cli},
    pyth_solana_receiver::sdk::{
        deserialize_accumulator_update_data, get_random_treasury_id, VAA_SPLIT_INDEX,
    },
    pyth_solana_receiver_sdk::config::DataSource,
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    serde_wormhole::RawMessage,
    solana_client::{rpc_client::RpcClient, rpc_config::RpcSendTransactionConfig},
    solana_sdk::{
        commitment_config::CommitmentConfig,
        compute_budget::ComputeBudgetInstruction,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        rent::Rent,
        signature::{read_keypair_file, Keypair},
        signer::Signer,
        system_instruction,
        transaction::Transaction,
    },
    std::{thread::sleep, time::Duration},
    wormhole_core_bridge_solana::sdk::{WriteEncodedVaaArgs, VAA_START},
    wormhole_sdk::{
        vaa::{Body, Header},
        Vaa,
    },
    wormhole_solana::{
        instructions::{
            initialize, post_vaa, upgrade_guardian_set, verify_signatures_txs, PostVAAData,
        },
        Account, Config as BridgeConfig, GuardianSet, VAA as LegacyPostedVaa,
    },
};

const INITIAL_GUARDIAN: &str = "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"; // Mainnet intial guardian set so we can use stable price feeds
const UPGRADE_GUARDIAN_SET_VAA_1 : &str = "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_2 : &str = "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_3 : &str = "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_4 : &str = "01000000030d03d4a37a6ff4361d91714730831e9d49785f61624c8f348a9c6c1d82bc1d98cadc5e936338204445c6250bb4928f3f3e165ad47ca03a5d63111168a2de4576856301049a5df10464ea4e1961589fd30fc18d1970a7a2ffaad617e56a0f7777f25275253af7d10a0f0f2494dc6e99fc80e444ab9ebbbee252ded2d5dcb50cbf7a54bb5a01055f4603b553b9ba9e224f9c55c7bca3da00abb10abd19e0081aecd3b352be061a70f79f5f388ebe5190838ef3cd13a2f22459c9a94206883b739c90b40d5d74640006a8fade3997f650a36e46bceb1f609edff201ab32362266f166c5c7da713f6a19590c20b68ed3f0119cb24813c727560ede086b3d610c2d7a1efa66f655bad90900080f5e495a75ea52241c59d145c616bfac01e57182ad8d784cbcc9862ed3afb60c0983ccbc690553961ffcf115a0c917367daada8e60be2cbb8b8008bac6341a8c010935ab11e0eea28b87a1edc5ccce3f1fac25f75b5f640fe6b0673a7cd74513c9dc01c544216cf364cc9993b09fda612e0cd1ced9c00fb668b872a16a64ebb55d27010ab2bc39617a2396e7defa24cd7c22f42dc31f3c42ffcd9d1472b02df8468a4d0563911e8fb6a4b5b0ce0bd505daa53779b08ff660967b31f246126ed7f6f29a7e000bdb6d3fd7b33bdc9ac3992916eb4aacb97e7e21d19649e7fa28d2dd6e337937e4274516a96c13ac7a8895da9f91948ea3a09c25f44b982c62ce8842b58e20c8a9000d3d1b19c8bb000856b6610b9d28abde6c35cb7705c6ca5db711f7be96d60eed9d72cfa402a6bfe8bf0496dbc7af35796fc768da51a067b95941b3712dce8ae1e7010ec80085033157fd1a5628fc0c56267469a86f0e5a66d7dede1ad4ce74ecc3dff95b60307a39c3bfbeedc915075070da30d0395def9635130584f709b3885e1bdc0010fc480eb9ee715a2d151b23722b48b42581d7f4001fc1696c75425040bfc1ffc5394fe418adb2b64bd3dc692efda4cc408163677dbe233b16bcdabb853a20843301118ee9e115e1a0c981f19d0772b850e666591322da742a9a12cce9f52a5665bd474abdd59c580016bee8aae67fdf39b315be2528d12eec3a652910e03cc4c6fa3801129d0d1e2e429e969918ec163d16a7a5b2c6729aa44af5dccad07d25d19891556a79b574f42d9adbd9e2a9ae5a6b8750331d2fccb328dd94c3bf8791ee1bfe85aa00661e99781981faea00010000000000000000000000000000000000000000000000000000000000000004fd4c6c55ec8dfd342000000000000000000000000000000000000000000000000000000000436f726502000000000004135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_5 : &str = "01000000040d00ada3cbcc53ec9abef64822eb3bf61784a1cf36dd7975a6f1fa793dfd35cd5b865b0b8daf6e7eec309d870423c5a5b7898cd56933ca82c824941d932766a014a70001b7731ff820ad5b3f97972428a81c8c8b1c55a42e8ae55f46a95ee7423fd4074b3f03c609cfff926a096fe642a1c939d7946972e1bea2bce02b40b766eb5b23e1010321738f8fb68652f1bb485b171badc3b0d347ad3cbcdc95aad0119020a5f1d46d1d9d92fd423a345b0f2ab2a722a25cace96acca0d1c4f2c839285ed06a6f0fb20104e67cedf1d48251817accb73647b0d16e1d565d1951baf62b1654b0bb26d516992df131dfdefcc499a41b7a49dead0cb03498ef6108018d88ab5c80397a83432401057f6a06e6d10f5d6cd84b552e866abc58c9899bb2a68956eaafca5988c19e8fc979a1d530636f1f897fb039d108d0b7fd4fde8679f75244cf3e10ffd1f605190c010675dac57d998d88ea80ad7078b6bf88d73abe8ed2ca960a17736c9a7dbfa168fa1c843b7e43883a0a15d0884bf2a397acacef142da51eec01bac331bd6e3aeb160008391dc0b9eed3fadc57528f2c32a6a060833aced6d617b95d39ea00300ca3e15951b175d1da741d31293d3bbedd1826d708675feb3bce56c58535592cdd4a5592000a8f30bde711c2d2b7e7f453be7a42b8da724008a34597c329c3989ecdd4f368f50d61b7b8c4c7d9f46e28334c4185d03284d90552b1f98cf0cd82c63fb5ecab63000cf67fb4e05463c3982a2379d1f779ad4364ba6ca5b240de82af4affc4c6ee58a52a972e21bbb254f15a4ea74cb511e32f06c021d9e774b34526e681dfa3537593000ea13cf78e719c7238fceb16f6fa1eb08de4c516b3e4c491b63382fdf3df5199543183c1ca67625178fb341484f58a18379bad73625637f0b64bae6b676b89033d000f8e4cfb95d01f4f84bf249038f64c10fb2d94f3a0429b01f853665deeebeae5e47e9d93926c97e1925b4be373e6ef96a606bc032b27a1bbcef95caa5c4f24dea0011111a9fc56e090fb01a739611ca9fd3de40ec53eeeb833e2b4fbab2dfdc176d60c734532248f2b2e5e0fbee8408245a8ca5d57440c6d596e981ade750a6e17928a011296e2fd4197141394987d06218f7b99b709adfb9e0511a177f9bfde8e7fbe1d4b55b9e4c2af3a70d2f73d6df12c3a60e6a677d476ff4393b9779f2735dbcd36e80169b6aee4a49c205b00010000000000000000000000000000000000000000000000000000000000000004fcdad9b63b91b4422000000000000000000000000000000000000000000000000000000000436f726502000000000005135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e2343938f104aeb5581293216ce97d771e0cb721221b115e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe70811d1f64e26238811de5553c40f64af41ee1b6057cc43ac8f567a31e7850da532b361988bfe0d3ae11b178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const GUARDIAN_EXPIRATION_TIME: u32 = 86400;
const SVM_CHAINS_WITH_RPC: &[(&str, Option<&str>)] = &[
    (
        "eclipse_testnet",
        Some("https://testnet.dev2.eclipsenetwork.xyz"),
    ),
    (
        "eclipse_mainnet",
        Some("https://mainnetbeta-rpc.eclipse.xyz"),
    ),
    ("sonic_devnet", Some("https://api.testnet.sonic.game")),
    ("sonic_testnet", Some("https://api.testnet.sonic.game")),
    (
        "sonic_mainnet",
        Some("https://api.mainnet-alpha.sonic.game"),
    ),
    ("fogo_mainnet", Some("https://mainnet.fogo.io")),
    // Fogo testnet uses testnet WH guardians
];

fn main() -> Result<()> {
    let cli = Cli::parse();
    let Cli {
        action,
        keypair,
        url,
        wormhole,
    } = cli;

    match action {
        Action::PostPriceUpdate { payload } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let payload_bytes: Vec<u8> = base64::decode(payload)?;
            let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(payload_bytes)?;

            process_write_encoded_vaa_and_post_price_update(
                &rpc_client,
                &vaa,
                wormhole,
                &payer,
                &merkle_price_updates[0],
            )?;
        }
        Action::PostPriceUpdateAtomic {
            payload,
            n_signatures,
        } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let payload_bytes: Vec<u8> = base64::decode(payload)?;
            let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(payload_bytes)?;

            process_post_price_update_atomic(
                &rpc_client,
                &vaa,
                n_signatures,
                &wormhole,
                &payer,
                &merkle_price_updates[0],
            )?;
        }
        Action::PostTwapUpdate {
            start_payload,
            end_payload,
        } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let start_payload_bytes: Vec<u8> = base64::decode(start_payload)?;
            let end_payload_bytes: Vec<u8> = base64::decode(end_payload)?;

            let (start_vaa, start_merkle_price_updates) =
                deserialize_accumulator_update_data(start_payload_bytes)?;
            let (end_vaa, end_merkle_price_updates) =
                deserialize_accumulator_update_data(end_payload_bytes)?;

            process_write_encoded_vaa_and_post_twap_update(
                &rpc_client,
                &start_vaa,
                &end_vaa,
                wormhole,
                &payer,
                &start_merkle_price_updates[0],
                &end_merkle_price_updates[0],
            )?;
        }
        Action::InitializeWormholeReceiver {} => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            initialize_wormhole_receiver(&rpc_client, wormhole, &payer)?;
        }
        Action::InitializeWormholeReceiverAllSvm {
            retries,
            retry_delay_seconds,
        } => {
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let retries = retries.max(1);
            let retry_delay = Duration::from_secs(retry_delay_seconds);
            let mut failures: Vec<(String, String)> = vec![];

            for &(chain, default_url) in SVM_CHAINS_WITH_RPC {
                let Some(rpc_url) = default_url else {
                    eprintln!("[{chain}] skipping: unresolved RPC URL");
                    continue;
                };

                println!("\n[{chain}] rpc={rpc_url}");

                let mut last_error = String::new();
                let mut succeeded = false;
                for attempt in 1..=retries {
                    println!("[{chain}] attempt {attempt}/{retries}");
                    let rpc_client = RpcClient::new(rpc_url.to_owned());
                    match initialize_wormhole_receiver(&rpc_client, wormhole, &payer) {
                        Ok(()) => {
                            println!("[{chain}] success");
                            succeeded = true;
                            break;
                        }
                        Err(err) => {
                            last_error = format!("{err:#}");
                            eprintln!("[{chain}] attempt {attempt} failed: {last_error}");
                            if attempt < retries {
                                eprintln!("[{chain}] retrying in {retry_delay_seconds} seconds...");
                                sleep(retry_delay);
                            }
                        }
                    }
                }

                if !succeeded {
                    failures.push((chain.to_string(), last_error));
                }
            }

            if !failures.is_empty() {
                eprintln!("\nInitialization failures:");
                for (chain, error) in &failures {
                    eprintln!(" - {chain}: {error}");
                }
                return Err(anyhow!(
                    "failed to initialize wormhole receiver on {} chain(s)",
                    failures.len()
                ));
            }
        }

        Action::UpdateGuardianSetTtl {} => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let wormhole_config = BridgeConfig::key(&wormhole, ());

            let instruction = Instruction {
                program_id: wormhole,
                accounts: vec![AccountMeta::new(wormhole_config, false)],
                data: vec![9], // UpdateGuardianSetTtl
            };
            process_transaction(&rpc_client, vec![instruction], &vec![&payer])?;
        }

        Action::InitializePythReceiver {
            fee,
            emitter,
            chain,
            governance_authority,
        } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let initialize_pyth_receiver_instruction =
                pyth_solana_receiver::instruction::Initialize::populate(
                    &payer.pubkey(),
                    pyth_solana_receiver_sdk::config::Config {
                        governance_authority,
                        target_governance_authority: None,
                        wormhole,
                        valid_data_sources: vec![DataSource { chain, emitter }],
                        single_update_fee_in_lamports: fee,
                        minimum_signatures: 3,
                    },
                );

            process_transaction(
                &rpc_client,
                vec![initialize_pyth_receiver_instruction],
                &vec![&payer],
            )?;
        }
    }
    Ok(())
}

fn initialize_wormhole_receiver(
    rpc_client: &RpcClient,
    wormhole: Pubkey,
    payer: &Keypair,
) -> Result<()> {
    // Check whether the wormhole config account exists, if it does not exist, initialize the wormhole receiver
    let wormhole_config = BridgeConfig::key(&wormhole, ());

    let wormhole_account_data = rpc_client.get_account_data(&wormhole_config);

    let mut current_guardian_set_index = match wormhole_account_data {
        Ok(data) => {
            let config = BridgeConfig::try_from_slice(&data)?;
            println!("Wormhole already initialized. config: {config:?}");
            config.guardian_set_index
        }
        Err(_) => {
            println!("Initializing wormhole receiver");
            let initial_guardian =
                hex::decode(INITIAL_GUARDIAN).context("failed to decode INITIAL_GUARDIAN hex")?;
            let initialize_instruction = initialize(
                wormhole,
                payer.pubkey(),
                0,
                GUARDIAN_EXPIRATION_TIME,
                &[initial_guardian
                    .try_into()
                    .map_err(|_| anyhow!("invalid INITIAL_GUARDIAN size"))?],
            )
            .context("failed to create initialize instruction")?;
            process_transaction(rpc_client, vec![initialize_instruction], &vec![payer])?;
            0
        }
    };

    if current_guardian_set_index == 0 {
        println!("Upgrading guardian set from 0 to 1");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(UPGRADE_GUARDIAN_SET_VAA_1)
                .context("failed to decode guardian set VAA 1")?,
            wormhole,
            payer,
            true,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 1 {
        println!("Upgrading guardian set from 1 to 2");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(UPGRADE_GUARDIAN_SET_VAA_2)
                .context("failed to decode guardian set VAA 2")?,
            wormhole,
            payer,
            false,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 2 {
        println!("Upgrading guardian set from 2 to 3");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(UPGRADE_GUARDIAN_SET_VAA_3)
                .context("failed to decode guardian set VAA 3")?,
            wormhole,
            payer,
            false,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 3 {
        println!("Upgrading guardian set from 3 to 4");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(UPGRADE_GUARDIAN_SET_VAA_4)
                .context("failed to decode guardian set VAA 4")?,
            wormhole,
            payer,
            false,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 4 {
        println!("Upgrading guardian set from 4 to 5");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(UPGRADE_GUARDIAN_SET_VAA_5)
                .context("failed to decode guardian set VAA 5")?,
            wormhole,
            payer,
            false,
        )?;
    }

    Ok(())
}

pub fn process_upgrade_guardian_set(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    legacy_guardian_set: bool,
) -> Result<()> {
    let posted_vaa = process_legacy_post_vaa(rpc_client, vaa, wormhole, payer, legacy_guardian_set)
        .context("failed to post guardian-set VAA")?;
    let parsed_vaa: Vaa<&RawMessage> =
        serde_wormhole::from_slice(vaa).context("failed to deserialize guardian-set VAA")?;
    let (header, body): (Header, Body<&RawMessage>) = parsed_vaa.into();
    let guardian_set_index_old = header.guardian_set_index;
    let emitter = Pubkey::from(body.emitter_address.0);
    let sequence = body.sequence;

    let update_guardian_set_instruction = upgrade_guardian_set(
        wormhole,
        payer.pubkey(),
        posted_vaa,
        guardian_set_index_old,
        emitter,
        sequence,
    )
    .context("failed to build upgrade_guardian_set instruction")?;

    process_transaction(
        rpc_client,
        vec![update_guardian_set_instruction],
        &vec![payer],
    )?;
    Ok(())
}

pub fn process_post_price_update_atomic(
    rpc_client: &RpcClient,
    vaa: &[u8],
    n_signatures: usize,
    wormhole: &Pubkey,
    payer: &Keypair,
    merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    let price_update_keypair = Keypair::new();

    let (mut header, body): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(vaa).unwrap();
    trim_signatures(&mut header, n_signatures);

    let request_compute_units_instruction: Instruction =
        ComputeBudgetInstruction::set_compute_unit_limit(400_000);

    let post_update_instruction = pyth_solana_receiver::instruction::PostUpdateAtomic::populate(
        payer.pubkey(),
        payer.pubkey(),
        price_update_keypair.pubkey(),
        *wormhole,
        header.guardian_set_index,
        serde_wormhole::to_vec(&(header, body)).unwrap(),
        merkle_price_update.clone(),
        get_random_treasury_id(),
    );

    process_transaction(
        rpc_client,
        vec![request_compute_units_instruction, post_update_instruction],
        &vec![payer, &price_update_keypair],
    )?;
    Ok(price_update_keypair.pubkey())
}

fn trim_signatures(header: &mut Header, n_signatures: usize) {
    header.signatures = header.signatures[..(n_signatures)].to_vec();
}

fn deserialize_guardian_set(buf: &mut &[u8], legacy_guardian_set: bool) -> Result<GuardianSet> {
    if !legacy_guardian_set {
        // Skip anchor discriminator
        *buf = &buf[8..];
    }
    let guardian_set = GuardianSet::deserialize(buf)?;
    Ok(guardian_set)
}

/**
 * This function posts a VAA to Solana using the legacy way, this way is still used for governance messages like guardian set updates
 */
pub fn process_legacy_post_vaa(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    legacy_guardian_set: bool,
) -> Result<Pubkey> {
    let parsed_vaa: Vaa<&RawMessage> =
        serde_wormhole::from_slice(vaa).context("failed to deserialize posted VAA")?;
    let (header, body): (Header, Body<&RawMessage>) = parsed_vaa.into();

    let wormhole_config = BridgeConfig::key(&wormhole, ());

    let wormhole_config_data =
        BridgeConfig::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

    let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);

    let guardian_set_data = deserialize_guardian_set(
        &mut &rpc_client.get_account_data(&guardian_set)?[..],
        legacy_guardian_set,
    )?;

    let vaa_hash = body
        .digest()
        .context("failed to hash VAA body digest")?
        .hash;
    let vaa_pubkey = LegacyPostedVaa::key(&wormhole, vaa_hash);

    let signature_set_keypair = Keypair::new();

    let verify_txs = verify_signatures_txs(
        vaa,
        guardian_set_data,
        wormhole,
        payer.pubkey(),
        wormhole_config_data.guardian_set_index,
        signature_set_keypair.pubkey(),
    )?;

    for tx in verify_txs {
        process_transaction(rpc_client, tx, &vec![payer, &signature_set_keypair])?;
    }
    let post_vaa_data = PostVAAData {
        version: header.version,
        guardian_set_index: header.guardian_set_index,
        timestamp: body.timestamp,
        nonce: body.nonce,
        emitter_chain: body.emitter_chain.into(),
        emitter_address: body.emitter_address.0,
        sequence: body.sequence,
        consistency_level: body.consistency_level,
        payload: body.payload.to_vec(),
    };

    process_transaction(
        rpc_client,
        vec![post_vaa(
            wormhole,
            payer.pubkey(),
            signature_set_keypair.pubkey(),
            post_vaa_data,
        )?],
        &vec![payer],
    )?;

    rpc_client.get_account_data(&vaa_pubkey).ok();

    Ok(vaa_pubkey)
}

/**
 * This function posts a VAA using the new way of interacting with wormhole and then posts a price update using the VAA
 */
pub fn process_write_encoded_vaa_and_post_price_update(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    let encoded_vaa_keypair = Keypair::new();

    // Transaction 1: Create and initialize VAA
    let init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        vaa,
        &wormhole,
        &encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        init_instructions,
        &vec![payer, &encoded_vaa_keypair],
    )?;

    // Transaction 2: Write remaining VAA data, verify VAA, and post price update
    let price_update_keypair = Keypair::new();
    let mut update_instructions = vec![ComputeBudgetInstruction::set_compute_unit_limit(600_000)];

    update_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        vaa,
        &encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);

    update_instructions.push(pyth_solana_receiver::instruction::PostUpdate::populate(
        payer.pubkey(),
        payer.pubkey(),
        encoded_vaa_keypair.pubkey(),
        price_update_keypair.pubkey(),
        merkle_price_update.clone(),
        get_random_treasury_id(),
    ));

    process_transaction(
        rpc_client,
        update_instructions,
        &vec![payer, &price_update_keypair],
    )?;
    println!(
        "Price update posted to account: {}",
        price_update_keypair.pubkey()
    );
    Ok(price_update_keypair.pubkey())
}

/// This function verifies start & end VAAs from Hermes via Wormhole to produce encoded VAAs,
/// and then posts a TWAP update using the encoded VAAs. Returns the TwapUpdate account pubkey.
///
/// The operation is split up into 4 transactions:
/// 1. Creates and initializes the start VAA account and writes its first part
/// 2. Creates and initializes the end VAA account and writes its first part
/// 3. Writes the remaining data for both VAAs and verifies them
/// 4. Posts the TWAP update
pub fn process_write_encoded_vaa_and_post_twap_update(
    rpc_client: &RpcClient,
    start_vaa: &[u8],
    end_vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    start_merkle_price_update: &MerklePriceUpdate,
    end_merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    // Create keypairs for both encoded VAAs
    let start_encoded_vaa_keypair = Keypair::new();
    let end_encoded_vaa_keypair = Keypair::new();

    // Transaction 1: Create and initialize start VAA
    let start_init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        start_vaa,
        &wormhole,
        &start_encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        start_init_instructions,
        &vec![payer, &start_encoded_vaa_keypair],
    )?;

    // Transaction 2: Create and initialize end VAA
    let end_init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        end_vaa,
        &wormhole,
        &end_encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        end_init_instructions,
        &vec![payer, &end_encoded_vaa_keypair],
    )?;

    // Transaction 3: Write remaining VAA data and verify both VAAs
    let mut verify_instructions = vec![ComputeBudgetInstruction::set_compute_unit_limit(850_000)];
    verify_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        start_vaa,
        &start_encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);
    verify_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        end_vaa,
        &end_encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);
    process_transaction(rpc_client, verify_instructions, &vec![payer])?;

    // Transaction 4: Post TWAP update
    let twap_update_keypair = Keypair::new();
    let post_instructions = vec![
        ComputeBudgetInstruction::set_compute_unit_limit(400_000),
        pyth_solana_receiver::instruction::PostTwapUpdate::populate(
            payer.pubkey(),
            payer.pubkey(),
            start_encoded_vaa_keypair.pubkey(),
            end_encoded_vaa_keypair.pubkey(),
            twap_update_keypair.pubkey(),
            start_merkle_price_update.clone(),
            end_merkle_price_update.clone(),
            get_random_treasury_id(),
        ),
    ];
    process_transaction(
        rpc_client,
        post_instructions,
        &vec![payer, &twap_update_keypair],
    )?;
    println!(
        "TWAP update posted to account: {}",
        twap_update_keypair.pubkey()
    );

    Ok(twap_update_keypair.pubkey())
}

/// Creates instructions to initialize an encoded VAA account and write the first part of the VAA data
pub fn init_encoded_vaa_and_write_initial_data_ixs(
    payer: &Pubkey,
    vaa: &[u8],
    wormhole: &Pubkey,
    encoded_vaa_keypair: &Keypair,
) -> Result<Vec<Instruction>> {
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    let create_encoded_vaa = system_instruction::create_account(
        payer,
        &encoded_vaa_keypair.pubkey(),
        Rent::default().minimum_balance(encoded_vaa_size),
        encoded_vaa_size as u64,
        wormhole,
    );

    let init_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::InitEncodedVaa {
        write_authority: *payer,
        encoded_vaa: encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let init_encoded_vaa_instruction = Instruction {
        program_id: *wormhole,
        accounts: init_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
    };

    let write_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
        write_authority: *payer,
        draft_vaa: encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let write_encoded_vaa_instruction = Instruction {
        program_id: *wormhole,
        accounts: write_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: 0,
                data: vaa[..VAA_SPLIT_INDEX].to_vec(),
            },
        }
        .data(),
    };

    Ok(vec![
        create_encoded_vaa,
        init_encoded_vaa_instruction,
        write_encoded_vaa_instruction,
    ])
}

/// Creates instructions to write remaining VAA data and verify the VAA
pub fn write_remaining_data_and_verify_vaa_ixs(
    payer: &Pubkey,
    vaa: &[u8],
    encoded_vaa_keypair: &Pubkey,
    wormhole: Pubkey,
) -> Result<Vec<Instruction>> {
    let write_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
        write_authority: *payer,
        draft_vaa: *encoded_vaa_keypair,
    }
    .to_account_metas(None);

    let write_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts: write_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: VAA_SPLIT_INDEX.try_into().unwrap(),
                data: vaa[VAA_SPLIT_INDEX..].to_vec(),
            },
        }
        .data(),
    };

    let (header, _): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(vaa).unwrap();
    let guardian_set = GuardianSet::key(&wormhole, header.guardian_set_index);

    let verify_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
        guardian_set,
        write_authority: *payer,
        draft_vaa: *encoded_vaa_keypair,
    }
    .to_account_metas(None);

    let verify_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts: verify_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    };

    Ok(vec![
        write_encoded_vaa_instruction,
        verify_encoded_vaa_instruction,
    ])
}

pub fn process_transaction(
    rpc_client: &RpcClient,
    instructions: Vec<Instruction>,
    signers: &Vec<&Keypair>,
) -> Result<()> {
    let mut transaction = Transaction::new_with_payer(&instructions, Some(&signers[0].pubkey()));
    transaction.sign(signers, rpc_client.get_latest_blockhash()?);

    let transaction_signature_res = rpc_client
        .send_and_confirm_transaction_with_spinner_and_config(
            &transaction,
            CommitmentConfig::confirmed(),
            RpcSendTransactionConfig {
                skip_preflight: true,
                ..Default::default()
            },
        );
    match transaction_signature_res {
        Ok(signature) => {
            println!("Transaction successful : {signature:?}");
            Ok(())
        }
        Err(err) => {
            println!("transaction err: {err:?}");
            Err(err.into())
        }
    }
}

use std::{path::Path, process::Command, str};

use libsecp256k1::SecretKey;
use primitive_types::U256;
use test_vaas::{
    locate_vaa_in_price_update, print_as_cairo_fn, re_sign_price_update, serialize_vaa, u256_to_be,
    DataSource, EthAddress, GuardianSet, GuardianSetUpgrade,
};
use wormhole_vaas::{PayloadKind, VaaBody};

fn main() {
    println!("// Generated with generate_test_data.rs, do not edit\n");
    println!("use pyth::byte_array::{{ByteArray, ByteArrayImpl}};");
    println!("use pyth::util::array_try_into;");

    // A random update pulled from Hermes.
    let good_update1 = "504e41550100000003b801000000030d012bd1c73ae62606cc22fa95389107ff631c6b0d2aebbb38aa8d910429381580fd3aa13c6261b09fe5e7a6aca95ec96e47ae1a9fd98cd4d0d41e47fdbf19724ed30002ddc260d7b4628cc28e474f86c503cfb287c6d5a60d200a002d0a3b5c3701ba786a6d154aec99d76817f6ae90fe080940c937be8720bbaa3bc21de539b97d9ff7000384ad07fb4f26ebab316b3ebdede91dbb10e4268ad70c3cce30f968e4fabb325a16e2cfe937cc02a069909639a78a8e3c2e2ca53a2d9ce1dc85e8bdb61eadee4101042942b2e17b7e99117517672d1cbd89e5da1615e708e6e1dd49879205921acd1e33b819cbfbf26169f5ef5dfdf02a7cd4a7bd41f33aea14dd29140970e9858edd0006544d201b1b95eb1641795cb4c6338bceb63c1c4ca8f134395dbb5a75c3fdb90b16a143f5e6dc7faab81f50e5d56fda369d2f9bc99bd5c0fb3f78613242d4ecec0107b02ae3c83b21351b8f1c339b65eea873b290006bc0ae3f861b6dd6255883951c457fb6247994f6253c38274a405937cf4ae8e474f6e163db4bc9248402edac2f00086cd9010c7705eff836747cd716153308bfa39ed545e4c8df5475feae6661b2a41fd6834f7a1876283a7ce3209d855702ee189ad22e3631cb504518c75c2e7bdc010a2e29ae09b85df5809e9e2ac459624234051256c36575ef0102736cf3e65f03262b3f4dbec893209b680f2944e892a615f4160bd6e72f0b3d970e273c44f03d50000b0f0fd2c29a2b64869bf861a9be037d2edede3b82b846090d81799d4c197ea7a1358bc65dd5bee2742d8b4e92e759d1774ed014eca366fba7717daa94df769f67010c102f7ec54c04626bd968ea350c8581af8d5ec9f7ebbbbc56e0587d6f467bd0212916e0cb9f99145d623dfc52ca07924f106702a66a7f51d67a257350cadd1745000e39e122d682330e9581197dddd0d8d6bf1628bc09f3ee69b68eee157f1bbd59ac0677f9fb37544f11405b0bf4dd1e3c5dc2056968df22cc8061664add6d5311cd0010814b1ea44a2a417009e9b62852136254aa9fb4476f9271c2f3000631cde32070424a2db74b83190473f8c4bc8e63b14b51d4aa48035d228c7674350526a348e701121efcf29494744eea7701e035b94241f00b2572ee05d85f462e09b24b5d1ed316593de7e3d3ad8daa6bc0962d4023dd8b0ec02ba66ed5bf58c2fe6bfbbe733c4e016614099700000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa710000000002f031610141555756000000000007fa222f0000271020e47520c30e6991ec9502edf0eefdc9f1e81c3501005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b430000068a84c7a55a00000000d65e41d9fffffff8000000006614099600000000661409960000068828be9ea000000000f430669c0a0a23ee383d3da068e7578080bd96d41efe039a589c6291a45bced2935e1948dbfbef05e035116c4c1262a2893e7ffa7829d982f39b9a3003fd171b2673754715f7dd52e652fdf5e12f4cddb8272d773d8f8b62aa8e156a615dd6ac7f604475dcb0294b6630f1264bd9950eab29a0397694e694b85378f13532c8bc2861cf8d21eebf795403e3827b113d961f6cf47dff7538abd141faa4b2b8fa21aacd098066eee782ba9434ec0b0907eac638408e648a6e501734b039b4dc30937b8f4f345b1afc3c2a46341f43";
    let good_update1 = hex::decode(good_update1).unwrap();
    print_as_cairo_fn(
        &good_update1,
        "good_update1",
        "A random update pulled from Hermes.",
    );
    let indexes = locate_vaa_in_price_update(&good_update1);
    print_as_cairo_fn(
        &good_update1[indexes.pos_before_vaa..indexes.pos_after_vaa],
        "good_vm1",
        "A wormhole VAA from a random update pulled from Hermes.",
    );

    let unique_update1 = "504e41550100000003b801000000040d005b559fa0622f058b45c1555ead2be24660e47d8d831ff3ae788631df2992a1934d3b16658fcd380e065ab1f8087495235aa6e8d2d376cc2e37ee0e680776a5db00010c2a51f4c1237d1ee8bd55b801206ca80706b01136301634fba9bf4063fc8bb924713c3b1459223ec130f52bf4068250c918b25dc30cf52b4f1cdc3b9b5bbc8b000252a99f4e643c7ffbe458092aa7f891a18341f731258c5e078a7a8ab09d73ebae2a613c682cd5c506c07d86b7fb5c104bb0655a3375a95665ea571494eabaa37101036a55cb75a40a9bb12ef22a5637182fd369d2df5fde60c2916ceff7a48344a4f23298aca2f2e24ac45b9abdc1fcd9d72abfb0680a789ebf1aa893d530a0f2f730010422b93f207001d12873ff2433623bdd2a4ae13d608faf17526967d3becf8481454fd95513ee42604731670fa402d39400c806e1abf3f5c08dfe46a3ba6b6c68b3000682528509a3ae808f0c0f15d51ba0d1bf2f5d1f580299a86883a1fcc2956c22327d2873147c5e1cdbe80bf5db38806a3885e882bee4d9e88fd78353b54a023c58000a49f8de527aed1b00d6a2570604084dfa08efa4fdda48e3c58c4f7ca851af1d4f0d9d15c820a1091db313dacdf6e1475cadec6555dfcca1e59d13cd223313a21e010b51fe1a2ca196264a0a60621646cf4eb88568b22546a7f38a8d9d4e0335c019455c5371dfb519ce559fc68cd06c8002143e951e02d8d612a64f3e660c7dab722e010c48c6714ad81751f5f384110303cba83bfdf7478f8a83754d825593310eacc51d5c9daa5baa7b520139f8f857f36607893343ff67a47f09b7ce16221294e87355000d9aeffbd732081d226c960786abd13de3d584a34099ef871435a3c4a0eede7751482684c5d72f7a8d4353a5bb6ef2dad237c924546b35c39b6edbdfc9aebe046b000e513b486bb5a3b96ab6f0c0382cb96a1063bb6111fd7edab5fa9e628233ae013225b7b63785baf85e6411a67a8329d784f7adaf19bc5ec754f9f08f2836530193000ff68e15c56975cf2dd7f560c31f421d35c6c6e4678ae50b33b579ddd2d24abcfc3799675d319572efaf7dd0a2a7b3428d377cf62bf5e279d875aaf867e418b5320012fec4c69ce1cbcf1920f082464586935d20ba586809d270b529e1ab90cce91286251ab5564bcb4a102b2ffbd8349a9715c3a1c6f10c0edab4e189c70917e30122016655e3ef00000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa7100000000038b07160141555756000000000008952599000027101e0d33a78138b9851ffe9cfca4292ccf08673f9a01005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b4300000623d837b3ff00000001bd545ac7fffffff8000000006655e3ef000000006655e3ee00000632e33606200000000173bf35780a95bda876f7988be2c629ca0f6609677fc3d1ba1efc25dbfb05753be57a1e6243c5a52544e6c1653ef7a177cbb33b6f0bc1b9d147d4acdaad63d7a8ef2f745293e53e9094d00f0c68e8d885487287880bc3f959cb50a44cd00bc65bfd2531e446592b06a4028acc92ee4a59b6a1335949e9383e0613218628c47a5b5d1bb9455df399c87c8adeaa3e6664b0b861c3449311786160f8e56d6c60f263e1c60d102d6aafaa4aa61e74590ec3fe697cb9d9ff4714e12b59675b69013c2c229b6877242aa94fd300c58771";
    let unique_update1 = hex::decode(unique_update1).unwrap();
    print_as_cairo_fn(
        &unique_update1,
        "unique_update1",
        "A first update for a certain timestamp pulled from Hermes.",
    );

    // These are actual guardian set upgrade VAAS from
    // https://github.com/pyth-network/pyth-crosschain/blob/main/contract_manager/src/contracts/wormhole.ts#L32-L37
    let wormhole_mainnet_upgrades = [
        "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d",
        "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d",
        "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d",
        "01000000030d03d4a37a6ff4361d91714730831e9d49785f61624c8f348a9c6c1d82bc1d98cadc5e936338204445c6250bb4928f3f3e165ad47ca03a5d63111168a2de4576856301049a5df10464ea4e1961589fd30fc18d1970a7a2ffaad617e56a0f7777f25275253af7d10a0f0f2494dc6e99fc80e444ab9ebbbee252ded2d5dcb50cbf7a54bb5a01055f4603b553b9ba9e224f9c55c7bca3da00abb10abd19e0081aecd3b352be061a70f79f5f388ebe5190838ef3cd13a2f22459c9a94206883b739c90b40d5d74640006a8fade3997f650a36e46bceb1f609edff201ab32362266f166c5c7da713f6a19590c20b68ed3f0119cb24813c727560ede086b3d610c2d7a1efa66f655bad90900080f5e495a75ea52241c59d145c616bfac01e57182ad8d784cbcc9862ed3afb60c0983ccbc690553961ffcf115a0c917367daada8e60be2cbb8b8008bac6341a8c010935ab11e0eea28b87a1edc5ccce3f1fac25f75b5f640fe6b0673a7cd74513c9dc01c544216cf364cc9993b09fda612e0cd1ced9c00fb668b872a16a64ebb55d27010ab2bc39617a2396e7defa24cd7c22f42dc31f3c42ffcd9d1472b02df8468a4d0563911e8fb6a4b5b0ce0bd505daa53779b08ff660967b31f246126ed7f6f29a7e000bdb6d3fd7b33bdc9ac3992916eb4aacb97e7e21d19649e7fa28d2dd6e337937e4274516a96c13ac7a8895da9f91948ea3a09c25f44b982c62ce8842b58e20c8a9000d3d1b19c8bb000856b6610b9d28abde6c35cb7705c6ca5db711f7be96d60eed9d72cfa402a6bfe8bf0496dbc7af35796fc768da51a067b95941b3712dce8ae1e7010ec80085033157fd1a5628fc0c56267469a86f0e5a66d7dede1ad4ce74ecc3dff95b60307a39c3bfbeedc915075070da30d0395def9635130584f709b3885e1bdc0010fc480eb9ee715a2d151b23722b48b42581d7f4001fc1696c75425040bfc1ffc5394fe418adb2b64bd3dc692efda4cc408163677dbe233b16bcdabb853a20843301118ee9e115e1a0c981f19d0772b850e666591322da742a9a12cce9f52a5665bd474abdd59c580016bee8aae67fdf39b315be2528d12eec3a652910e03cc4c6fa3801129d0d1e2e429e969918ec163d16a7a5b2c6729aa44af5dccad07d25d19891556a79b574f42d9adbd9e2a9ae5a6b8750331d2fccb328dd94c3bf8791ee1bfe85aa00661e99781981faea00010000000000000000000000000000000000000000000000000000000000000004fd4c6c55ec8dfd342000000000000000000000000000000000000000000000000000000000436f726502000000000004135893b5a76c3f739645648885bdccc06cd70a3cd3ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d",
      ];

    for (id, item) in wormhole_mainnet_upgrades.into_iter().enumerate() {
        let item = hex::decode(item).unwrap();
        print_as_cairo_fn(&item, format!("mainnet_guardian_set_upgrade{}", id + 1),
        "An actual mainnet wormhole governance VAA from \
        https://github.com/pyth-network/pyth-crosschain/blob/main/contract_manager/src/contracts/wormhole.ts#L32-L37");
    }

    // Generated with `generate_keypair.rs`.
    let secret1 = "047f10198517025e9bf2f6d09ebb650826b35397f01ca2a64a38348cae653f86";
    let address1_hex = "686b9ea8e3237110eaaba1f1b7467559a3273819";
    let address1 = EthAddress(hex::decode(address1_hex).unwrap());
    println!("\npub const TEST_GUARDIAN_ADDRESS1: felt252 = 0x{address1_hex};");

    let secret2 = "a95d32e5e2b9464b3f49a0f7ef2ede3ff17585836b253b96c832a86d2b5614cb";
    let address2_hex = "363598f080a817e633fc2d8f2b92e6e637f8b449";
    let address2 = EthAddress(hex::decode(address2_hex).unwrap());
    println!("pub const TEST_GUARDIAN_ADDRESS2: felt252 = 0x{address2_hex};");

    let guardians = GuardianSet {
        set_index: 0,
        secrets: vec![SecretKey::parse_slice(&hex::decode(secret1).unwrap()).unwrap()],
    };

    let empty_set_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(4.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 60051,
                        set_index: 1,
                        guardians: Vec::new(),
                    }
                    .serialize(),
                ),
            },
        ),
    );
    print_as_cairo_fn(
        &empty_set_upgrade,
        "empty_set_upgrade",
        "An invalid wormhole guardian set upgrade instruction containing no new guardians.",
    );

    let wrong_emitter_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(5.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 60051,
                        set_index: 1,
                        guardians: vec![address1.clone()],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    print_as_cairo_fn(
        &wrong_emitter_upgrade,
        "wrong_emitter_upgrade",
        "A wormhole guardian set upgrade instruction with emitter not expected by the test.",
    );

    let wrong_index_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(4.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 0,
                        set_index: 3,
                        guardians: vec![address1.clone()],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    print_as_cairo_fn(
        &wrong_index_upgrade,
        "wrong_index_upgrade",
        "A wormhole guardian set upgrade instruction with set index = 3 not expected by the test.",
    );

    let upgrade_to_test2 = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(4.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 0,
                        set_index: 1,
                        guardians: vec![address2],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    print_as_cairo_fn(
        &upgrade_to_test2,
        "upgrade_to_test2",
        "A wormhole governance guardian set upgrade instruction signed by test guardian #1 containing \
        test guardian #2 as the new guardian set.",
    );

    // Pyth governance payload bytes are copied from
    // `governance/xc_admin/packages/xc_admin_common/src/__tests__/GovernancePayload.test.ts`
    let pyth_set_fee_payload = vec![
        80, 84, 71, 77, 1, 3, 234, 147, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 2,
    ];
    let pyth_set_fee = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(pyth_set_fee_payload.clone()),
        },
    ));
    print_as_cairo_fn(
        &pyth_set_fee,
        "pyth_set_fee",
        "A Pyth governance instruction to set fee signed by the test guardian #1.",
    );

    let pyth_set_data_sources = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![
                80, 84, 71, 77, 1, 2, 234, 147, 2, 0, 1, 107, 177, 69, 9, 166, 18, 240, 31, 187,
                196, 207, 254, 235, 212, 187, 251, 73, 42, 134, 223, 113, 126, 190, 146, 235, 109,
                244, 50, 163, 240, 10, 37, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 45,
            ]),
        },
    ));
    print_as_cairo_fn(
        &pyth_set_data_sources,
        "pyth_set_data_sources",
        "A Pyth governance instruction to set data sources signed by the test guardian #1.",
    );

    let pyth_set_wormhole = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![
                80, 84, 71, 77, 1, 6, 234, 147, 5, 3, 63, 6, 213, 196, 123, 204, 231, 150, 14, 167,
                3, 176, 74, 11, 246, 75, 243, 63, 111, 46, 181, 97, 52, 150, 218, 116, 117, 34,
                217, 194,
            ]),
        },
    ));
    print_as_cairo_fn(
        &pyth_set_wormhole,
        "pyth_set_wormhole",
        "A Pyth governance instruction to set wormhole address signed by the test guardian #1.",
    );

    let pyth_request_transfer = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 2,
            emitter_address: u256_to_be(43.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![80, 84, 71, 77, 1, 5, 234, 147, 0, 0, 0, 1]),
        },
    ));
    print_as_cairo_fn(
        &pyth_request_transfer,
        "pyth_request_transfer",
        "A Pyth governance instruction to request governance data source transfer signed by the test guardian #1.",
    );

    let mut pyth_auth_transfer_payload = vec![80, 84, 71, 77, 1, 1, 234, 147];
    pyth_auth_transfer_payload.extend_from_slice(&pyth_request_transfer);
    let pyth_auth_transfer = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(pyth_auth_transfer_payload),
        },
    ));
    print_as_cairo_fn(
        &pyth_auth_transfer,
        "pyth_auth_transfer",
        "A Pyth governance instruction to authorize governance data source transfer signed by the test guardian #1.",
    );

    let pyth_set_fee_alt_emitter = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 2,
            emitter_address: u256_to_be(43.into()).into(),
            sequence: 2.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(pyth_set_fee_payload.clone()),
        },
    ));
    print_as_cairo_fn(
        &pyth_set_fee_alt_emitter,
        "pyth_set_fee_alt_emitter",
        "A Pyth governance instruction to set fee with alternative emitter signed by the test guardian #1.",
    );

    let contracts_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contracts");
    let status = Command::new("scarb")
        .arg("build")
        .current_dir(&contracts_dir)
        .output()
        .unwrap()
        .status;
    assert!(status.success(), "scarb failed with {status:?}");

    let upgrade_hashes = [
        ("fake1", get_class_hash("fake_upgrade1", &contracts_dir)),
        (
            "not_pyth",
            get_class_hash("fake_upgrade_not_pyth", &contracts_dir),
        ),
        (
            "wrong_magic",
            get_class_hash("fake_upgrade_wrong_magic", &contracts_dir),
        ),
        ("invalid_hash", 505.into()),
    ];
    for (name, hash) in upgrade_hashes {
        let mut pyth_upgrade_payload = vec![80, 84, 71, 77, 1, 0, 234, 147];
        pyth_upgrade_payload.extend_from_slice(&u256_to_be(hash));
        let pyth_upgrade = serialize_vaa(guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(41.into()).into(),
                sequence: 1.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(pyth_upgrade_payload),
            },
        ));
        print_as_cairo_fn(
            &pyth_upgrade,
            format!("pyth_upgrade_{name}"),
            "A Pyth governance instruction to upgrade the contract signed by the test guardian #1.",
        );
    }

    let guardians2 = GuardianSet {
        set_index: 1,
        secrets: vec![SecretKey::parse_slice(&hex::decode(secret2).unwrap()).unwrap()],
    };

    // Random updates pulled from Hermes:
    let data = [
        "504e41550100000003b801000000040d005320dd51d28e0cf68194b22a752470c331df400572b0ca981e34e7d00febfa1121c18ef67a0407fec72db62cdd96222a88bbbcffa93b027f610415302c96de1b00028be7fac9d4a0f3bd207b5791c8b79bec28444c00866191710264b44b57ca5ffe78c82a73bdc9f2beaeb99376bca5d1cb2a5680dead59271ad92823dd94ad1a550103b6fdd034183a36cbcdf347854315ab3b1433a7e701f86c19ba7e60bb36aac3c073ffde73fe4215780c891e15918833a423dde9facce4ec4067c21431c3dd4e110004fa2a06375fea37513caf730e24acd5a51c60bd430938963e436feb8e16ab670419040b5587d12c73b50673e7b963abb927a764671654760946ed01eef411eab9010600aeb3f7e650ce14572204b740de60d3854af67ec619a1d3167c79051a311eed7488f33561c80ba96e67033ff3648a553c4776020eb4f9a3af42251ee000e71300070640f3a0789ba8b70ee0b74e18099f9d22ee9194cace268fc9976dbcdfbcd45163dbab0de5cdd530e0047c27d6d3c30e306234d91c58da5f4f89179ba19d07b5000bd6ef9e47ee571f6373e3111f140fef8368e650c01276c8f1184e6e5928eb0ad670a31d512b7bf60d990ef25c6d4786b24dd3d71001d3301e04b671a16b011dae000ccaab09d4a142d240a500e2e427a3a1eedbbbafb38ab5175bd67beea6f1016f221ca4d47be4689aaa19cdcc844624d43d59786a56f305de5f4672bd5f7701bc50010dbf778eb450a84295bf0601c21a2e136f33f95094d560e268861730573a55bfbe2a460498af433ae0d697c6c0e67a018684305faa05046d3a223c83f44f01cd5c010e1bd1dabe6e765fd5336157a6f927caa63c1538b9a323c6dc106aa4ed08b590ab3b42dcd92ecf1e016ee9c7e0482d199d98fd918cd3e9b3da7f405bfb1e9796da010f8e2b4b0a9a68ac00c0afe3d85390718d4eaca5f46c0fa57a2502774bfa24232813b542ca615987bdd1a9f46205ef5e7d21a4218ea77fe57b2aee6964bbec5b030010e1f9798036c3b17a5ce3b20a2bba3abc7683daeff6879f971bc8419ab45bab7618ff9b00a75cb1a047a241b177c98da8aedf2e6d5600cac0df474c1a73c4f8530012afb324617a35a631e904f7b53c3683f002936668f719c0c406a92141470fc30567453771501e37c0f25eb7d36e790b9e0d14aa2c502be01c73e6c680cec45d97006644907f00000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa710000000003611faa01415557560000000000086b3d2c0000271079b5cb7d4c7e1c85556ad969e75614b8a272383701005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43000005b66c59a10000000000b8c11371fffffff8000000006644907e000000006644907e000005ae1b11cdc000000000bccb64b80a266a8aa8ed85761b2716dec7ff80ca93d6463616aaaa0083c4f5764c15cf3da1fd27d31ba71e9b87ad7fdb966c073f4a13e3bb2f0fad258c22041e2edf87f279e6e9570c5376bb170044ed9c4b7989793410368db52de5774bfdd9fb1a182cd1b4c59eb0b84f78d9fbaf9e60dbebb48b23e013799ed36b4a1aa2a98fe3533275198c97d48f3139e5e688c926a9975244315131ee0078e847daa0bda876e1a509c7b8afe9888696b49f424641e6cb2d271576948a8428030d171c3f67fd1dd9ba62fe1a464b7849c2",
        "504e41550100000003b801000000040d0078c1c39cc9036ff5b77ab57320c9063446902ca4d8a093eac4f483b58897fdea6ace38344d5b1beb85830c4c6ce6a1069587fe465d90b04baa3e7b31d9d4bf1401019bd155786ca5ba0b0892d6deb4652ee4807e524dde320ef786ae87005bffd319343d4c5fb73a1a37bc070b7b5701efdf5a1d30758aa6501abaa3538a971c1a6e0102e6ac44fc5c5475a791df7b6894993308fc73b760f6386cca37181504b4c981c1427cf9075b396b014d28471dc9a127097e43f7aa3d84253de55f28fbdc0c1e6400035e5570e94a512303d5e6a2fcad70e894a49422a9aae0f33d3b3c817a3a481f3b0e83d84052a1adc88bb5c4e9f243c1cac659aef7f91afd3c8d8345a26632b7480104a605e54eb1aadf738cfa6738e7f8e33cc8c7de75a095165302e3ab531eb5320c09e43454a0fbd6ae73465fd5d74933eba5500c089d65af9cb82ad171f63fae44000625c6f3ec9d903240d136ea1f401f815e559eee6ae0e1b64ccb458fc1e988b8b57ea91188d806a331b47a63de6a2669fb3efc683f5a3a59b5ad56523b46593f0a0107f0fea4b0113f2890ea9214a5cf306c44d6c6c411b26683d9ef29a001a1ec7f211e5a30aab07feddc488c2b7dfeccddd03a95786571899a5b329e813d997b5ded010b6a8542ebe7bfd20893ae6fcba2d9e1c10ffeada79f5bc98fa12cc81b773916780d1c48110065ece3647763c78e995447d691b298630fce719ba5a9bf06b667af000c776d09592a76644442801fd127ed93cc2eef0c7091a15befca05b5896acb19b376bf3499a30b2bf1e4728024fb38ab907e719523e7b61119d93e90686a94550e000ddf0fbecc9dba2b7487ed62bdd78a099aa20c587bfd8a73ac1e7ef344e7cfe5fb4ba92c20f174ac66ecd64b6cf994bf34b6d6cee6582bbaaf14b6a870078de96b000e19479568bb774e1a0b4b985c00e7747c70067daa96ab44008c86784b8b0ee6c729d0632003f9343730a452f359029a0961a260003d8d75245f0c8aa3db23023f010f1ebefdcd36a2fd6b72ce8fabe9e9e16ede44ef2b1c5179a4e44c0ca3a7b24cf03dcee54d90b28fd21dd649581616348565ad30d53fffc75a804bc25b29a85efb0112ca92c3b2c08afc49c7fc49c6678735563c6b3b5fc199ff70c951adb94dfaec0659d0543073a69ab1a8dd46be673af96fafd0c65d83ebfa274239dc7c383ac4c9016644908400000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa710000000003611fb601415557560000000000086b3d38000027102c9a35a044ed7becf6fb4d92621d48a930c5b0c501005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43000005b687eb22a900000000d0458627fffffff800000000664490830000000066449083000005ae1e43acc000000000bccb05040adf16c33ea64586472be0d01955ca53f009516b22cad85d8fa0255b15c4f0381b21c92f9861976eeb6fb48d0916e7b5d9c84c96f2f55b8ddee8292b5f737aa48b71bcf5cde935ad180852b00eb9689e4ce50ac2aaa85a2aa42c0d9573b8cc46f9518279e5f5681cd7449ac980c550e409242667480c8e9f3c9ea6a43d7d5a0f1b1969a81e3bf9fa0ea613fb4ef01ab0d7d1e587223a510e17061f9a29a8f52c64fb219556a265c5026844792da87ff3bc59b913bc16a56bd50680b342bd86a51640f9161ebcaa17ca",
    ];
    for (index, item) in data.into_iter().enumerate() {
        let data = re_sign_price_update(&hex::decode(item).unwrap(), &guardians, None);
        print_as_cairo_fn(
            &data,
            format!("test_price_update{}", index + 1),
            "An update pulled from Hermes and re-signed by the test guardian #1.",
        );
    }

    let test_update2_alt_emitter = re_sign_price_update(
        &hex::decode(data[1]).unwrap(),
        &guardians,
        Some(DataSource {
            emitter_chain_id: 3,
            emitter_address: u256_to_be(301.into()).into(),
        }),
    );
    print_as_cairo_fn(
        &test_update2_alt_emitter,
        "test_update2_alt_emitter",
        "An update pulled from Hermes and re-signed by the test guardian #1 with another emitter address.",
    );

    let test_update2_set2 = re_sign_price_update(&hex::decode(data[1]).unwrap(), &guardians2, None);
    print_as_cairo_fn(
        &test_update2_set2,
        "test_update2_set2",
        "An update pulled from Hermes and re-signed by the test guardian #2.",
    );
}

fn get_class_hash(name: &str, dir: &Path) -> U256 {
    let output = Command::new("starkli")
        .arg("class-hash")
        .arg(format!("target/dev/pyth_pyth_{name}.contract_class.json"))
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "starkli failed with {:?}",
        output.status
    );
    let hash = str::from_utf8(&output.stdout).unwrap();
    hash.trim().parse().unwrap()
}

export type EntropyDeployment = {
  address: string;
  rpc: string;
  explorerTxTemplate: string;
  explorerAccountTemplate: string;
  name: string;
  icon: string;
  isTestnet: boolean;
  chainId: number;
};

export const EntropyDeployments = {
  abstract: {
    address: "0x5a4a369F4db5df2054994AF031b7b23949b98c0e",
    chainId: 2741,
    explorerAccountTemplate: "https://abscan.org/address/$ADDRESS",
    explorerTxTemplate: "https://abscan.org/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_abstract.jpg?w=20&h=20",
    isTestnet: false,
    name: "Abstract",
    rpc: "https://api.mainnet.abs.xyz",
  },
  "abstract-sepolia-testnet": {
    address: "0x858687fD592112f7046E394A3Bf10D0C11fF9e63",
    chainId: 11_124,
    explorerAccountTemplate:
      "https://explorer.testnet.abs.xyz/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.testnet.abs.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_abstract.jpg?w=20&h=20",
    isTestnet: true,
    name: "Abstract Sepolia Testnet",
    rpc: "https://api.testnet.abs.xyz",
  },
  apechain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 33_139,
    explorerAccountTemplate: "https://apescan.io/address/$ADDRESS",
    explorerTxTemplate: "https://apescan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_apechain.jpg?w=20&h=20",
    isTestnet: false,
    name: "ApeChain",
    rpc: "https://apechain.calderachain.xyz/http",
  },
  "arbitrum-one": {
    address: "0x7698E925FfC29655576D0b361D75Af579e20AdAc",
    chainId: 42_161,
    explorerAccountTemplate: "https://arbiscan.io/address/$ADDRESS",
    explorerTxTemplate: "https://arbiscan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg?w=20&h=20",
    isTestnet: false,
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
  },
  "arbitrum-sepolia": {
    address: "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440",
    chainId: 421_614,
    explorerAccountTemplate: "https://sepolia.arbiscan.io/address/$ADDRESS",
    explorerTxTemplate: "https://sepolia.arbiscan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg?w=20&h=20",
    isTestnet: true,
    name: "Arbitrum Sepolia",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
  },
  b3: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 8333,
    explorerAccountTemplate: "https://explorer.b3.fun/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.b3.fun/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_b3?w=20&h=20",
    isTestnet: false,
    name: "B3",
    rpc: "https://mainnet-rpc.b3.fun/http",
  },
  "b3-sepolia-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 1993,
    explorerAccountTemplate: "https://sepolia.explorer.b3.fun/address/$ADDRESS",
    explorerTxTemplate: "https://sepolia.explorer.b3.fun/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_b3?w=20&h=20",
    isTestnet: true,
    name: "B3 Sepolia Testnet",
    rpc: "https://sepolia.b3.fun/http/",
  },
  base: {
    address: "0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb",
    chainId: 8453,
    explorerAccountTemplate: "https://basescan.org/address/$ADDRESS",
    explorerTxTemplate: "https://basescan.org/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg?w=20&h=20",
    isTestnet: false,
    name: "Base",
    rpc: "https://developer-access-mainnet.base.org/",
  },
  "base-sepolia-testnet": {
    address: "0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c",
    chainId: 84_532,
    explorerAccountTemplate:
      "https://base-sepolia.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://base-sepolia.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg?w=20&h=20",
    isTestnet: true,
    name: "Base Sepolia Testnet",
    rpc: "https://sepolia.base.org",
  },
  berachain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 80_094,
    explorerAccountTemplate: "https://berascan.com/address/$ADDRESS",
    explorerTxTemplate: "https://berascan.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_berachain?w=20&h=20",
    isTestnet: false,
    name: "Berachain",
    rpc: "https://rpc.berachain.com/",
  },
  "berachain-bepolia": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 80_069,
    explorerAccountTemplate: "https://bepolia.beratrail.io/address/$ADDRESS",
    explorerTxTemplate: "https://bepolia.beratrail.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_berachain?w=20&h=20",
    isTestnet: true,
    name: "Berachain Bepolia",
    rpc: "https://bepolia.rpc.berachain.com",
  },
  blast: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 81_457,
    explorerAccountTemplate: "https://blastscan.io/address/$ADDRESS",
    explorerTxTemplate: "https://blastscan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_blast.jpg?w=20&h=20",
    isTestnet: false,
    name: "Blast",
    rpc: "https://rpc.blast.io",
  },
  "blast-sepolia-testnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    chainId: 168_587_773,
    explorerAccountTemplate: "https://sepolia.blastscan.io/address/$ADDRESS",
    explorerTxTemplate: "https://sepolia.blastscan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_blast.jpg?w=20&h=20",
    isTestnet: true,
    name: "Blast Sepolia Testnet",
    rpc: "https://sepolia.blast.io",
  },
  "chiliz-chain": {
    address: "0x0708325268dF9F66270F1401206434524814508b",
    chainId: 88_888,
    explorerAccountTemplate: "https://scan.chiliz.com/address/$ADDRESS",
    explorerTxTemplate: "https://scan.chiliz.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_chiliz.jpg?w=20&h=20",
    isTestnet: false,
    name: "Chiliz Chain",
    rpc: "https://rpc.ankr.com/chiliz",
  },
  "chiliz-spicy-testnet": {
    address: "0xD458261E832415CFd3BAE5E416FdF3230ce6F134",
    chainId: 88_882,
    explorerAccountTemplate:
      "https://spicy-explorer.chiliz.com/address/$ADDRESS",
    explorerTxTemplate: "https://spicy-explorer.chiliz.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_chiliz.jpg?w=20&h=20",
    isTestnet: true,
    name: "Chiliz Spicy Testnet",
    rpc: "https://spicy-rpc.chiliz.com",
  },
  curtis: {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    chainId: 33_111,
    explorerAccountTemplate:
      "https://curtis.explorer.caldera.xyz/address/$ADDRESS",
    explorerTxTemplate: "https://curtis.explorer.caldera.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_apechain.jpg?w=20&h=20",
    isTestnet: true,
    name: "Curtis",
    rpc: "https://curtis.rpc.caldera.xyz/http",
  },
  "etherlink-mainnet": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    chainId: 42_793,
    explorerAccountTemplate: "https://explorer.etherlink.com/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.etherlink.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_etherlink.jpg?w=20&h=20",
    isTestnet: false,
    name: "Etherlink Mainnet",
    rpc: "https://node.mainnet.etherlink.com/",
  },
  "etherlink-testnet": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    chainId: 128_123,
    explorerAccountTemplate:
      "https://testnet.explorer.etherlink.com/address/$ADDRESS",
    explorerTxTemplate: "https://testnet.explorer.etherlink.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_etherlink.jpg?w=20&h=20",
    isTestnet: true,
    name: "Etherlink Testnet",
    rpc: "https://node.ghostnet.etherlink.com",
  },
  hyperevm: {
    address: "0xfA25E653b44586dBbe27eE9d252192F0e4956683",
    chainId: 999,
    explorerAccountTemplate:
      "https://hyperliquid.cloud.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://hyperliquid.cloud.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_hyperevm?w=20&h=20",
    isTestnet: false,
    name: "HyperEVM",
    rpc: "https://rpc.hyperliquid.xyz/evm",
  },
  "kaia-kairos-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 1001,
    explorerAccountTemplate: "https://kairos.kaiascan.io/address/$ADDRESS",
    explorerTxTemplate: "https://kairos.kaiascan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_klaytn.jpg?w=20&h=20",
    isTestnet: true,
    name: "Kaia Kairos Testnet",
    rpc: "https://rpc.ankr.com/klaytn_testnet",
  },
  "kaia-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 8217,
    explorerAccountTemplate: "https://kaiascan.io/address/$ADDRESS",
    explorerTxTemplate: "https://kaiascan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_klaytn.jpg?w=20&h=20",
    isTestnet: false,
    name: "Kaia Mainnet",
    rpc: "https://rpc.ankr.com/klaytn",
  },
  "lightlink-pegasus-testnet": {
    address: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
    chainId: 1891,
    explorerAccountTemplate: "https://pegasus.lightlink.io/address/$ADDRESS",
    explorerTxTemplate: "https://pegasus.lightlink.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_lightlink?w=20&h=20",
    isTestnet: true,
    name: "Lightlink Pegasus Testnet",
    rpc: "https://replicator.pegasus.lightlink.io/rpc/v1",
  },
  "lightlink-phoenix-mainnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    chainId: 1890,
    explorerAccountTemplate: "https://phoenix.lightlink.io/address/$ADDRESS",
    explorerTxTemplate: "https://phoenix.lightlink.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_lightlink?w=20&h=20",
    isTestnet: false,
    name: "Lightlink Phoenix Mainnet",
    rpc: "https://replicator.phoenix.lightlink.io/rpc/v1",
  },
  "merlin-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 4200,
    explorerAccountTemplate: "https://scan.merlinchain.io/address/$ADDRESS",
    explorerTxTemplate: "https://scan.merlinchain.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_merlin.jpg?w=20&h=20",
    isTestnet: false,
    name: "Merlin Mainnet",
    rpc: "https://rpc.merlinchain.io",
  },
  "merlin-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 686_868,
    explorerAccountTemplate:
      "https://testnet-scan.merlinchain.io/address/$ADDRESS",
    explorerTxTemplate: "https://testnet-scan.merlinchain.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_merlin?w=20&h=20",
    isTestnet: true,
    name: "Merlin Testnet",
    rpc: "https://testnet-rpc.merlinchain.io/",
  },
  mode: {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    chainId: 34_443,
    explorerAccountTemplate: "https://explorer.mode.network/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.mode.network/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_mode?w=20&h=20",
    isTestnet: false,
    name: "Mode",
    rpc: "https://mainnet.mode.network/",
  },
  "mode-testnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    chainId: 919,
    explorerAccountTemplate: "https://testnet.modescan.io/address/$ADDRESS",
    explorerTxTemplate: "https://testnet.modescan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_mode?w=20&h=20",
    isTestnet: true,
    name: "Mode Testnet",
    rpc: "https://sepolia.mode.network/",
  },
  monad: {
    address: "0xd458261e832415cfd3bae5e416fdf3230ce6f134",
    chainId: 143,
    explorerAccountTemplate: "https://monadvision.com/address/$ADDRESS",
    explorerTxTemplate: "https://monadvision.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg?w=20&h=20",
    isTestnet: false,
    name: "Monad",
    rpc: "https://rpc-mainnet.monadinfra.com",
  },
  "monad-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 10_143,
    explorerAccountTemplate:
      "https://testnet.monadexplorer.com/address/$ADDRESS",
    explorerTxTemplate: "https://testnet.monadexplorer.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg?w=20&h=20",
    isTestnet: true,
    name: "Monad Testnet",
    rpc: "https://testnet-rpc.monad.xyz",
  },
  "op-mainnet": {
    address: "0xdF21D137Aadc95588205586636710ca2890538d5",
    chainId: 10,
    explorerAccountTemplate: "https://optimistic.etherscan.io/address/$ADDRESS",
    explorerTxTemplate: "https://optimistic.etherscan.io/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg?w=20&h=20",
    isTestnet: false,
    name: "OP Mainnet",
    rpc: "https://optimism.llamarpc.com",
  },
  "op-sepolia-testnet": {
    address: "0x4821932D0CDd71225A6d914706A621e0389D7061",
    chainId: 11_155_420,
    explorerAccountTemplate:
      "https://optimism-sepolia.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://optimism-sepolia.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg?w=20&h=20",
    isTestnet: true,
    name: "OP Sepolia Testnet",
    rpc: "https://api.zan.top/opt-sepolia",
  },
  sanko: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 1996,
    explorerAccountTemplate: "https://explorer.sanko.xyz/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.sanko.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sanko.jpg?w=20&h=20",
    isTestnet: false,
    name: "Sanko",
    rpc: "https://mainnet.sanko.xyz",
  },
  "sanko-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 1992,
    explorerAccountTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/address/$ADDRESS",
    explorerTxTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sanko.jpg?w=20&h=20",
    isTestnet: true,
    name: "Sanko Testnet",
    rpc: "https://sanko-arb-sepolia.rpc.caldera.xyz/http",
  },
  "sei-network": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    chainId: 1329,
    explorerAccountTemplate:
      "https://seitrace.com/address/$ADDRESS?chain=pacific-1",
    explorerTxTemplate: "https://seitrace.com/tx/$ADDRESS?chain=pacific-1",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sei.jpg?w=20&h=20",
    isTestnet: false,
    name: "Sei Network",
    rpc: "https://evm-rpc.sei-apis.com",
  },
  "sei-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 1328,
    explorerAccountTemplate:
      "https://seitrace.com/address/$ADDRESS?chain=atlantic-2",
    explorerTxTemplate: "https://seitrace.com/tx/$ADDRESS?chain=atlantic-2",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sei.jpg?w=20&h=20",
    isTestnet: true,
    name: "Sei Testnet",
    rpc: "https://evm-rpc-testnet.sei-apis.com",
  },
  soneium: {
    address: "0x0708325268dF9F66270F1401206434524814508b",
    chainId: 1868,
    explorerAccountTemplate: "https://soneium.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://soneium.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_soneium.jpg?w=20&h=20",
    isTestnet: false,
    name: "Soneium",
    rpc: "https://soneium.drpc.org",
  },
  "soneium-testnet-minato": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    chainId: 1946,
    explorerAccountTemplate:
      "https://explorer-testnet.soneium.org/address/$ADDRESS",
    explorerTxTemplate: "https://explorer-testnet.soneium.org/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_soneium.jpg?w=20&h=20",
    isTestnet: true,
    name: "Soneium Testnet Minato",
    rpc: "https://rpc.minato.soneium.org/",
  },
  "sonic-blaze-testnet": {
    address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
    chainId: 57_054,
    explorerAccountTemplate: "https://blaze.soniclabs.com/address/$ADDRESS",
    explorerTxTemplate: "https://blaze.soniclabs.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: true,
    name: "Sonic Blaze Testnet",
    rpc: "https://rpc.blaze.soniclabs.com",
  },
  "sonic-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 146,
    explorerAccountTemplate: "https://sonicscan.org/address/$ADDRESS",
    explorerTxTemplate: "https://sonicscan.org/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: false,
    name: "Sonic Mainnet",
    rpc: "https://rpc.soniclabs.com",
  },
  "sonic-testnet": {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    chainId: 14_601,
    explorerAccountTemplate: "https://testnet.sonicscan.org/address/$ADDRESS",
    explorerTxTemplate: "https://testnet.sonicscan.org/txs/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: true,
    name: "Sonic Testnet",
    rpc: "https://rpc.testnet.soniclabs.com",
  },
  story: {
    address: "0xdF21D137Aadc95588205586636710ca2890538d5",
    chainId: 1514,
    explorerAccountTemplate: "https://storyscan.xyz/address/$ADDRESS",
    explorerTxTemplate: "https://storyscan.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_story?w=20&h=20",
    isTestnet: false,
    name: "Story",
    rpc: "https://mainnet.storyrpc.io",
  },
  "story-aeneid-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    chainId: 1315,
    explorerAccountTemplate: "https://aeneid.storyscan.xyz/address/$ADDRESS",
    explorerTxTemplate: "https://aeneid.storyscan.xyz/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_story?w=20&h=20",
    isTestnet: true,
    name: "Story Aeneid Testnet",
    rpc: "https://aeneid.storyrpc.io",
  },
  "tabi-testnet-v2": {
    address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
    chainId: 9788,
    explorerAccountTemplate: "https://testnetv2.tabiscan.com/address/$ADDRESS",
    explorerTxTemplate: "https://testnetv2.tabiscan.com/tx/$ADDRESS",
    icon: "https://www.tabichain.com/images/new2/tabi.svg",
    isTestnet: true,
    name: "Tabi Testnet v2",
    rpc: "https://rpc.testnetv2.tabichain.com",
  },
  "taiko-alethia": {
    address: "0x26DD80569a8B23768A1d80869Ed7339e07595E85",
    chainId: 167_000,
    explorerAccountTemplate: "https://taikoscan.network/address/$ADDRESS",
    explorerTxTemplate: "https://taikoscan.network/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_taiko.jpg?w=20&h=20",
    isTestnet: false,
    name: "Taiko Alethia",
    rpc: "https://rpc.mainnet.taiko.xyz",
  },
  "taiko-hekla": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    chainId: 167_009,
    explorerAccountTemplate: "https://hekla.taikoscan.network/address/$ADDRESS",
    explorerTxTemplate: "https://hekla.taikoscan.network/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_taiko.jpg?w=20&h=20",
    isTestnet: true,
    name: "Taiko Hekla",
    rpc: "https://rpc.hekla.taiko.xyz/",
  },
  unichain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 130,
    explorerAccountTemplate: "https://unichain.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://unichain.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg?w=20&h=20",
    isTestnet: false,
    name: "Unichain",
    rpc: "https://mainnet.unichain.org",
  },
  "unichain-sepolia-testnet": {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    chainId: 1301,
    explorerAccountTemplate:
      "https://unichain-sepolia.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://unichain-sepolia.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg?w=20&h=20",
    isTestnet: true,
    name: "Unichain Sepolia Testnet",
    rpc: "https://sepolia.unichain.org",
  },
  "zetachain-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    chainId: 7000,
    explorerAccountTemplate:
      "https://zetachain.blockscout.com/address/$ADDRESS",
    explorerTxTemplate: "https://zetachain.blockscout.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_zetachain.jpg?w=20&h=20",
    isTestnet: false,
    name: "ZetaChain Mainnet",
    rpc: "https://zetachain-evm.blockpi.network/v1/rpc/public",
  },
  "zetachain-testnet": {
    address: "0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF",
    chainId: 7001,
    explorerAccountTemplate: "https://explorer.zetachain.com/address/$ADDRESS",
    explorerTxTemplate: "https://explorer.zetachain.com/tx/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_zetachain.jpg?w=20&h=20",
    isTestnet: true,
    name: "ZetaChain Testnet",
    rpc: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
  },
} as const satisfies Record<string, EntropyDeployment>;

export const isValidDeploymentSlug = (
  name: string,
): name is keyof typeof EntropyDeployments =>
  Object.hasOwn(EntropyDeployments, name);

export type ChainSlug =
  | keyof typeof EntropyDeployments
  | "all-mainnet"
  | "all-testnet";

export const parseChainSlug = (value: string | undefined) => {
  switch (value) {
    case "all-mainnet":
    case "all-testnet": {
      return value;
    }
    default: {
      return value !== undefined && isValidDeploymentSlug(value)
        ? value
        : "all-mainnet";
    }
  }
};

export const getChainName = (chainSlug: ChainSlug) =>
  isSpecialChainKey(chainSlug)
    ? CHAIN_LABELS[chainSlug]
    : EntropyDeployments[chainSlug].name;

export const getChainNetworkId = (chainSlug: ChainSlug) =>
  chainSlug === "all-mainnet" || chainSlug === "all-testnet"
    ? undefined
    : EntropyDeployments[chainSlug].chainId;

export const CHAIN_LABELS = {
  "all-mainnet": "All Mainnet Chains",
  "all-testnet": "All Testnet Chains",
};

export const isSpecialChainKey = (
  key: unknown,
): key is keyof typeof CHAIN_LABELS =>
  Object.keys(CHAIN_LABELS).includes(key as keyof typeof CHAIN_LABELS);

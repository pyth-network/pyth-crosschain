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
  "op-mainnet": {
    address: "0xdF21D137Aadc95588205586636710ca2890538d5",
    name: "OP Mainnet",
    rpc: "https://optimism.llamarpc.com",
    explorerTxTemplate: "https://optimistic.etherscan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://optimistic.etherscan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 10,
  },
  unichain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Unichain",
    rpc: "https://mainnet.unichain.org",
    explorerTxTemplate: "https://unichain.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://unichain.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 130,
  },
  "sonic-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Sonic Mainnet",
    rpc: "https://rpc.soniclabs.com",
    explorerTxTemplate: "https://sonicscan.org/tx/$ADDRESS",
    explorerAccountTemplate: "https://sonicscan.org/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 146,
  },
  "mode-testnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    name: "Mode Testnet",
    rpc: "https://sepolia.mode.network/",
    explorerTxTemplate: "https://testnet.modescan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://testnet.modescan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_mode?w=20&h=20",
    isTestnet: true,
    chainId: 919,
  },
  hyperevm: {
    address: "0xfA25E653b44586dBbe27eE9d252192F0e4956683",
    name: "HyperEVM",
    rpc: "https://rpc.hyperliquid.xyz/evm",
    explorerTxTemplate: "https://hyperliquid.cloud.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://hyperliquid.cloud.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_hyperevm?w=20&h=20",
    isTestnet: false,
    chainId: 999,
  },
  "kaia-kairos-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Kaia Kairos Testnet",
    rpc: "https://rpc.ankr.com/klaytn_testnet",
    explorerTxTemplate: "https://kairos.kaiascan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://kairos.kaiascan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_klaytn.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 1001,
  },
  "unichain-sepolia-testnet": {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    name: "Unichain Sepolia Testnet",
    rpc: "https://sepolia.unichain.org",
    explorerTxTemplate: "https://unichain-sepolia.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://unichain-sepolia.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 1301,
  },
  "story-aeneid-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "Story Aeneid Testnet",
    rpc: "https://aeneid.storyrpc.io",
    explorerTxTemplate: "https://aeneid.storyscan.xyz/tx/$ADDRESS",
    explorerAccountTemplate: "https://aeneid.storyscan.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_story?w=20&h=20",
    isTestnet: true,
    chainId: 1315,
  },
  "sei-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Sei Testnet",
    rpc: "https://evm-rpc-testnet.sei-apis.com",
    explorerTxTemplate: "https://seitrace.com/tx/$ADDRESS?chain=atlantic-2",
    explorerAccountTemplate:
      "https://seitrace.com/address/$ADDRESS?chain=atlantic-2",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sei.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 1328,
  },
  "sei-network": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    name: "Sei Network",
    rpc: "https://evm-rpc.sei-apis.com",
    explorerTxTemplate: "https://seitrace.com/tx/$ADDRESS?chain=pacific-1",
    explorerAccountTemplate:
      "https://seitrace.com/address/$ADDRESS?chain=pacific-1",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sei.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 1329,
  },
  story: {
    address: "0xdF21D137Aadc95588205586636710ca2890538d5",
    name: "Story",
    rpc: "https://mainnet.storyrpc.io",
    explorerTxTemplate: "https://storyscan.xyz/tx/$ADDRESS",
    explorerAccountTemplate: "https://storyscan.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_story?w=20&h=20",
    isTestnet: false,
    chainId: 1514,
  },
  soneium: {
    address: "0x0708325268dF9F66270F1401206434524814508b",
    name: "Soneium",
    rpc: "https://soneium.drpc.org",
    explorerTxTemplate: "https://soneium.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://soneium.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_soneium.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 1868,
  },
  "lightlink-phoenix-mainnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    name: "Lightlink Phoenix Mainnet",
    rpc: "https://replicator.phoenix.lightlink.io/rpc/v1",
    explorerTxTemplate: "https://phoenix.lightlink.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://phoenix.lightlink.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_lightlink?w=20&h=20",
    isTestnet: false,
    chainId: 1890,
  },
  "lightlink-pegasus-testnet": {
    address: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
    name: "Lightlink Pegasus Testnet",
    rpc: "https://replicator.pegasus.lightlink.io/rpc/v1",
    explorerTxTemplate: "https://pegasus.lightlink.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://pegasus.lightlink.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_lightlink?w=20&h=20",
    isTestnet: true,
    chainId: 1891,
  },
  "soneium-testnet-minato": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    name: "Soneium Testnet Minato",
    rpc: "https://rpc.minato.soneium.org/",
    explorerTxTemplate: "https://explorer-testnet.soneium.org/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://explorer-testnet.soneium.org/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_soneium.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 1946,
  },
  "sanko-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "Sanko Testnet",
    rpc: "https://sanko-arb-sepolia.rpc.caldera.xyz/http",
    explorerTxTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sanko.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 1992,
  },
  "b3-sepolia-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "B3 Sepolia Testnet",
    rpc: "https://sepolia.b3.fun/http/",
    explorerTxTemplate: "https://sepolia.explorer.b3.fun/tx/$ADDRESS",
    explorerAccountTemplate: "https://sepolia.explorer.b3.fun/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_b3?w=20&h=20",
    isTestnet: true,
    chainId: 1993,
  },
  sanko: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "Sanko",
    rpc: "https://mainnet.sanko.xyz",
    explorerTxTemplate: "https://explorer.sanko.xyz/tx/$ADDRESS",
    explorerAccountTemplate: "https://explorer.sanko.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sanko.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 1996,
  },
  abstract: {
    address: "0x5a4a369F4db5df2054994AF031b7b23949b98c0e",
    name: "Abstract",
    rpc: "https://api.mainnet.abs.xyz",
    explorerTxTemplate: "https://abscan.org/tx/$ADDRESS",
    explorerAccountTemplate: "https://abscan.org/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_abstract.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 2741,
  },
  "merlin-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Merlin Mainnet",
    rpc: "https://rpc.merlinchain.io",
    explorerTxTemplate: "https://scan.merlinchain.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://scan.merlinchain.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_merlin.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 4200,
  },
  "zetachain-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "ZetaChain Mainnet",
    rpc: "https://zetachain-evm.blockpi.network/v1/rpc/public",
    explorerTxTemplate: "https://zetachain.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://zetachain.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_zetachain.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 7000,
  },
  "zetachain-testnet": {
    address: "0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF",
    name: "ZetaChain Testnet",
    rpc: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
    explorerTxTemplate: "https://explorer.zetachain.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://explorer.zetachain.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_zetachain.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 7001,
  },
  "kaia-mainnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Kaia Mainnet",
    rpc: "https://rpc.ankr.com/klaytn",
    explorerTxTemplate: "https://kaiascan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://kaiascan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_klaytn.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 8217,
  },
  b3: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "B3",
    rpc: "https://mainnet-rpc.b3.fun/http",
    explorerTxTemplate: "https://explorer.b3.fun/tx/$ADDRESS",
    explorerAccountTemplate: "https://explorer.b3.fun/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_b3?w=20&h=20",
    isTestnet: false,
    chainId: 8333,
  },
  base: {
    address: "0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb",
    name: "Base",
    rpc: "https://developer-access-mainnet.base.org/",
    explorerTxTemplate: "https://basescan.org/tx/$ADDRESS",
    explorerAccountTemplate: "https://basescan.org/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 8453,
  },
  "tabi-testnet-v2": {
    address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
    name: "Tabi Testnet v2",
    rpc: "https://rpc.testnetv2.tabichain.com",
    explorerTxTemplate: "https://testnetv2.tabiscan.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://testnetv2.tabiscan.com/address/$ADDRESS",
    icon: "https://www.tabichain.com/images/new2/tabi.svg",
    isTestnet: true,
    chainId: 9788,
  },
  "monad-testnet": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Monad Testnet",
    rpc: "https://testnet-rpc.monad.xyz",
    explorerTxTemplate: "https://testnet.monadexplorer.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://testnet.monadexplorer.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 10_143,
  },
  monad: {
    address: "0xd458261e832415cfd3bae5e416fdf3230ce6f134",
    name: "Monad",
    rpc: "https://rpc-mainnet.monadinfra.com",
    explorerTxTemplate: "https://monadvision.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://monadvision.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 143,
  },
  "abstract-sepolia-testnet": {
    address: "0x858687fD592112f7046E394A3Bf10D0C11fF9e63",
    name: "Abstract Sepolia Testnet",
    rpc: "https://api.testnet.abs.xyz",
    explorerTxTemplate: "https://explorer.testnet.abs.xyz/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://explorer.testnet.abs.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_abstract.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 11_124,
  },
  curtis: {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    name: "Curtis",
    rpc: "https://curtis.rpc.caldera.xyz/http",
    explorerTxTemplate: "https://curtis.explorer.caldera.xyz/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://curtis.explorer.caldera.xyz/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_apechain.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 33_111,
  },
  apechain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "ApeChain",
    rpc: "https://apechain.calderachain.xyz/http",
    explorerTxTemplate: "https://apescan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://apescan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_apechain.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 33_139,
  },
  mode: {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    name: "Mode",
    rpc: "https://mainnet.mode.network/",
    explorerTxTemplate: "https://explorer.mode.network/tx/$ADDRESS",
    explorerAccountTemplate: "https://explorer.mode.network/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_mode?w=20&h=20",
    isTestnet: false,
    chainId: 34_443,
  },
  "arbitrum-one": {
    address: "0x7698E925FfC29655576D0b361D75Af579e20AdAc",
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorerTxTemplate: "https://arbiscan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://arbiscan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 42_161,
  },
  "etherlink-mainnet": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    name: "Etherlink Mainnet",
    rpc: "https://node.mainnet.etherlink.com/",
    explorerTxTemplate: "https://explorer.etherlink.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://explorer.etherlink.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_etherlink.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 42_793,
  },
  "sonic-blaze-testnet": {
    address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
    name: "Sonic Blaze Testnet",
    rpc: "https://rpc.blaze.soniclabs.com",
    explorerTxTemplate: "https://blaze.soniclabs.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://blaze.soniclabs.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 57_054,
  },
  "berachain-bepolia": {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Berachain Bepolia",
    rpc: "https://bepolia.rpc.berachain.com",
    explorerTxTemplate: "https://bepolia.beratrail.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://bepolia.beratrail.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_berachain?w=20&h=20",
    isTestnet: true,
    chainId: 80_069,
  },
  berachain: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    name: "Berachain",
    rpc: "https://rpc.berachain.com/",
    explorerTxTemplate: "https://berascan.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://berascan.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_berachain?w=20&h=20",
    isTestnet: false,
    chainId: 80_094,
  },
  blast: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "Blast",
    rpc: "https://rpc.blast.io",
    explorerTxTemplate: "https://blastscan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://blastscan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_blast.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 81_457,
  },
  "base-sepolia-testnet": {
    address: "0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c",
    name: "Base Sepolia Testnet",
    rpc: "https://sepolia.base.org",
    explorerTxTemplate: "https://base-sepolia.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://base-sepolia.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 84_532,
  },
  "chiliz-spicy-testnet": {
    address: "0xD458261E832415CFd3BAE5E416FdF3230ce6F134",
    name: "Chiliz Spicy Testnet",
    rpc: "https://spicy-rpc.chiliz.com",
    explorerTxTemplate: "https://spicy-explorer.chiliz.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://spicy-explorer.chiliz.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_chiliz.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 88_882,
  },
  "chiliz-chain": {
    address: "0x0708325268dF9F66270F1401206434524814508b",
    name: "Chiliz Chain",
    rpc: "https://rpc.ankr.com/chiliz",
    explorerTxTemplate: "https://scan.chiliz.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://scan.chiliz.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_chiliz.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 88_888,
  },
  "etherlink-testnet": {
    address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
    name: "Etherlink Testnet",
    rpc: "https://node.ghostnet.etherlink.com",
    explorerTxTemplate: "https://testnet.explorer.etherlink.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://testnet.explorer.etherlink.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_etherlink.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 128_123,
  },
  "taiko-alethia": {
    address: "0x26DD80569a8B23768A1d80869Ed7339e07595E85",
    name: "Taiko Alethia",
    rpc: "https://rpc.mainnet.taiko.xyz",
    explorerTxTemplate: "https://taikoscan.network/tx/$ADDRESS",
    explorerAccountTemplate: "https://taikoscan.network/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_taiko.jpg?w=20&h=20",
    isTestnet: false,
    chainId: 167_000,
  },
  "taiko-hekla": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    name: "Taiko Hekla",
    rpc: "https://rpc.hekla.taiko.xyz/",
    explorerTxTemplate: "https://hekla.taikoscan.network/tx/$ADDRESS",
    explorerAccountTemplate: "https://hekla.taikoscan.network/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_taiko.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 167_009,
  },
  "arbitrum-sepolia": {
    address: "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440",
    name: "Arbitrum Sepolia",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerTxTemplate: "https://sepolia.arbiscan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://sepolia.arbiscan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 421_614,
  },
  "merlin-testnet": {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    name: "Merlin Testnet",
    rpc: "https://testnet-rpc.merlinchain.io/",
    explorerTxTemplate: "https://testnet-scan.merlinchain.io/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://testnet-scan.merlinchain.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_merlin?w=20&h=20",
    isTestnet: true,
    chainId: 686_868,
  },
  "op-sepolia-testnet": {
    address: "0x4821932D0CDd71225A6d914706A621e0389D7061",
    name: "OP Sepolia Testnet",
    rpc: "https://api.zan.top/opt-sepolia",
    explorerTxTemplate: "https://optimism-sepolia.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://optimism-sepolia.blockscout.com/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 11_155_420,
  },
  "blast-sepolia-testnet": {
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
    name: "Blast Sepolia Testnet",
    rpc: "https://sepolia.blast.io",
    explorerTxTemplate: "https://sepolia.blastscan.io/tx/$ADDRESS",
    explorerAccountTemplate: "https://sepolia.blastscan.io/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_blast.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 168_587_773,
  },
  "sonic-testnet": {
    address: "0x8D254a21b3C86D32F7179855531CE99164721933",
    name: "Sonic Testnet",
    rpc: "https://rpc.testnet.soniclabs.com",
    explorerTxTemplate: "https://testnet.sonicscan.org/txs/$ADDRESS",
    explorerAccountTemplate: "https://testnet.sonicscan.org/address/$ADDRESS",
    icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg?w=20&h=20",
    isTestnet: true,
    chainId: 14_601,
  },
} as const satisfies Record<string, EntropyDeployment>;

export const isValidDeploymentSlug = (
  name: string,
): name is keyof typeof EntropyDeployments =>
  Object.prototype.hasOwnProperty.call(EntropyDeployments, name);

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

require("dotenv").config({ path: ".env" });
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  migrations_directory: process.env.MIGRATIONS_DIR,
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    ethereum: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://mainnet.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 1,
      gas: 10000000,
      gasPrice: 17000000000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: false,
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://ropsten.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 3,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://rinkeby.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 4,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://goerli.infura.io/v3/" + process.env.INFURA_KEY
        );
      },
      network_id: "5",
      gas: 8465030,
      gasPrice: 15000000000,
      skipDryRun: true,
    },
    bnb: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/bsc"
        );
      },
      network_id: "56",
      gas: 70000000,
      gasPrice: 5500000000,
    },
    bnb_testnet: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/bsc_testnet_chapel"
        ),
      network_id: "97",
      confirmations: 10,
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
      skipDryRun: true,
    },
    polygon: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://polygon-rpc.com"
        );
      },
      network_id: "137",
      gas: 20000000,
      gasPrice: 300000000000,
    },
    mumbai: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://polygon-testnet-rpc.allthatnode.com:8545"
        );
      },
      network_id: "80001",
    },
    avalanche: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://api.avax.network/ext/bc/C/rpc"
        );
      },
      network_id: "43114",
      gas: 8000000,
      gasPrice: 30000000000,
    },
    fuji: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          "https://api.avax-test.network/ext/bc/C/rpc"
        ),
      network_id: "43113",
    },
    oasis: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://emerald.oasis.dev/"
        );
      },
      network_id: 42262,
      gas: 4465030,
      gasPrice: 30000000000,
    },
    aurora: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://mainnet.aurora.dev"
        );
      },
      network_id: 0x4e454152,
      gas: 10000000,
      from: "0xC42e9476b0a458097087336e2395Dbf45B0BdC12", // creator public key
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
    },
    aurora_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://testnet.aurora.dev"
        );
      },
      network_id: 0x4e454153,
      gas: 10000000,
      from: "0xC42e9476b0a458097087336e2395Dbf45B0BdC12", // public key
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
    },
    arbitrum: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://arb1.arbitrum.io/rpc"
        );
      },
      network_id: 42161,
    },
    arbitrum_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://goerli-rollup.arbitrum.io/rpc"
        );
      },
      network_id: 421613,
    },
    optimism: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/optimism"
        );
      },
      network_id: 10,
    },
    optimism_goerli: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/optimism_testnet"
        );
      },
      network_id: 420,
    },
    fantom: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/fantom"
        );
      },
      network_id: 250,
      gas: 8000000,
      gasPrice: 50000000000,
      timeoutBlocks: 15000,
    },
    fantom_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc.ankr.com/fantom_testnet"
        );
      },
      network_id: 0xfa2,
      gas: 8000000,
      gasPrice: 300000000000,
    },
    celo: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://forno.celo.org"
        );
      },
      network_id: 42220,
    },
    celo_alfajores_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://alfajores-forno.celo-testnet.org"
        );
      },
      network_id: 44787,
    },
    kcc: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc-mainnet.kcc.network"
        );
      },
      network_id: 321,
    },
    kcc_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://rpc-testnet.kcc.network"
        );
      },
      network_id: 322,
    },
    zksync: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://zksync2-mainnet.zksync.io"
        );
      },
      network_id: 324,
    },
    zksync_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://zksync2-testnet.zksync.dev"
        );
      },
      network_id: 280,
    },
    cronos: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://cronosrpc-1.xstaking.sg"
        );
      },
      network_id: 25,
    },
    cronos_testnet: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://evm-t3.cronos.org"
        );
      },
      network_id: 338,
    },
  },

  compilers: {
    solc: {
      version: "0.8.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000,
        },
      },
    },
  },

  plugins: [
    "@chainsafe/truffle-plugin-abigen",
    "truffle-plugin-verify",
    "truffle-contract-size",
  ],

  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
    bscscan: process.env.BSCSCAN_KEY,
    snowtrace: process.env.SNOWTRACE_KEY,
    ftmscan: process.env.FTMSCAN_KEY,
    polygonscan: process.env.POLYGONSCAN_KEY,
    optimistic_etherscan: process.env.OPTIMISTIC_ETHERSCAN_KEY,
    aurorascan: process.env.AURORASCAN_KEY,
    arbiscan: process.env.ARBISCAN_KEY,
  },
};

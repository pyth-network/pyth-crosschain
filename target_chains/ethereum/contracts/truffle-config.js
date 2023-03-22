require("dotenv").config({ path: ".env" });
const HDWalletProvider = require("@truffle/hdwallet-provider");

/**
 *
 * @param {string} url
 * @returns {HDWalletProvider} An instance of HDWalletProvider
 */
function payerProvider(url) {
  return () =>
    new HDWalletProvider({
      mnemonic: process.env.MNEMONIC,
      providerOrUrl: url,
      // This option makes deployments more reliable (by avoiding rate limiting errors) at the cost of
      // taking a little longer.
      pollingInterval: 12000,
    });
}

module.exports = {
  migrations_directory: process.env.MIGRATIONS_DIR,
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    ethereum: {
      provider: payerProvider(
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
      provider: payerProvider(
        `https://ropsten.infura.io/v3/` + process.env.INFURA_KEY
      ),
      network_id: 3,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    rinkeby: {
      provider: payerProvider(
        `https://rinkeby.infura.io/v3/` + process.env.INFURA_KEY
      ),
      network_id: 4,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    goerli: {
      provider: payerProvider(
        `https://goerli.infura.io/v3/` + process.env.INFURA_KEY
      ),
      network_id: "5",
      gas: 8465030,
      gasPrice: 15000000000,
      skipDryRun: true,
    },
    bnb: {
      provider: payerProvider(`https://rpc.ankr.com/bsc`),
      network_id: "56",
      gas: 70000000,
      gasPrice: 5500000000,
    },
    bnb_testnet: {
      provider: payerProvider(`https://rpc.ankr.com/bsc_testnet_chapel`),
      network_id: "97",
      confirmations: 10,
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
      skipDryRun: true,
    },
    polygon: {
      provider: payerProvider(`https://polygon-rpc.com`),
      network_id: "137",
      gas: 20000000,
      gasPrice: 300000000000,
    },
    mumbai: {
      provider: payerProvider(
        `https://polygon-testnet-rpc.allthatnode.com:8545`
      ),
      network_id: "80001",
    },
    avalanche: {
      provider: payerProvider(`https://api.avax.network/ext/bc/C/rpc`),
      network_id: "43114",
      gas: 8000000,
      gasPrice: 30000000000,
    },
    fuji: {
      provider: payerProvider(`https://api.avax-test.network/ext/bc/C/rpc`),
      network_id: "43113",
    },
    oasis: {
      provider: payerProvider(`https://emerald.oasis.dev/`),
      network_id: 42262,
      gas: 4465030,
      gasPrice: 30000000000,
    },
    aurora: {
      provider: payerProvider(`https://mainnet.aurora.dev`),
      network_id: 0x4e454152,
      gas: 10000000,
      from: "0xC42e9476b0a458097087336e2395Dbf45B0BdC12", // creator public key
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
    },
    aurora_testnet: {
      provider: payerProvider(`https://testnet.aurora.dev`),
      network_id: 0x4e454153,
      gas: 10000000,
      from: "0xC42e9476b0a458097087336e2395Dbf45B0BdC12", // public key
      networkCheckTimeout: 1000000,
      timeoutBlocks: 1000,
    },
    arbitrum: {
      provider: payerProvider(`https://arb1.arbitrum.io/rpc`),
      network_id: 42161,
    },
    arbitrum_testnet: {
      provider: payerProvider(`https://goerli-rollup.arbitrum.io/rpc`),
      network_id: 421613,
    },
    optimism: {
      provider: payerProvider(`https://rpc.ankr.com/optimism`),
      network_id: 10,
    },
    optimism_goerli: {
      provider: payerProvider(`https://rpc.ankr.com/optimism_testnet`),
      network_id: 420,
    },
    fantom: {
      provider: payerProvider(`https://rpc.ankr.com/fantom`),
      network_id: 250,
      gas: 8000000,
      gasPrice: 50000000000,
      timeoutBlocks: 15000,
    },
    fantom_testnet: {
      provider: payerProvider(`https://rpc.ankr.com/fantom_testnet`),
      network_id: 0xfa2,
      gas: 8000000,
      gasPrice: 300000000000,
    },
    celo: {
      provider: payerProvider(`https://forno.celo.org`),
      network_id: 42220,
    },
    celo_alfajores_testnet: {
      provider: payerProvider(`https://alfajores-forno.celo-testnet.org`),
      network_id: 44787,
    },
    kcc: {
      provider: payerProvider(`https://rpc-mainnet.kcc.network`),
      network_id: 321,
    },
    kcc_testnet: {
      provider: payerProvider(`https://rpc-testnet.kcc.network`),
      network_id: 322,
    },
    zksync: {
      provider: payerProvider(`https://zksync2-mainnet.zksync.io`),
      network_id: 324,
    },
    zksync_goerli: {
      provider: payerProvider(`https://zksync2-testnet.zksync.dev`),
      network_id: 280,
    },
    cronos: {
      provider: payerProvider(`https://cronosrpc-1.xstaking.sg`),
      network_id: 25,
    },
    cronos_testnet: {
      provider: payerProvider(`https://evm-t3.cronos.org`),
      network_id: 338,
    },
    polygon_zkevm_testnet: {
      provider: payerProvider(`https://rpc.public.zkevm-test.net/`),
      network_id: 1442,
    },
    shimmer_testnet: {
      provider: payerProvider(`https://json-rpc.evm.testnet.shimmer.network`),
      network_id: 1070,
      verify: {
        apiUrl: "https://explorer.evm.testnet.shimmer.network/api",
        explorerUrl: "https://explorer.evm.testnet.shimmer.network",
        apiKey: "there_should_be_a_dummy_value_here_to_avoid_error",
      },
    },
    gnosis: {
      provider: payerProvider(`https://rpc.gnosischain.com`),
      network_id: 100,
    },
    chiado: {
      // gnosis testnet
      provider: payerProvider(`https://rpc.chiadochain.net`),
      network_id: 10200,
    },
    base_goerli: {
      provider: payerProvider(`https://goerli.base.org`),
      network_id: 84531,
      verify: {
        apiUrl: "https://api-goerli.basescan.org/api",
        explorerUrl: "https://goerli.basescan.org/",
        apiKey: "",
      },
    },
    evmos: {
      provider: payerProvider(`https://eth.bd.evmos.org:8545/`),
      network_id: 9001,
    },
    evmos_testnet: {
      provider: payerProvider(`https://eth.bd.evmos.dev:8545/`),
      network_id: 9000,
    },
    neon_devnet: {
      provider: payerProvider(`https://devnet.neonevm.org`),
      network_id: 245022926,
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

  plugins: ["truffle-plugin-verify", "truffle-contract-size"],

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

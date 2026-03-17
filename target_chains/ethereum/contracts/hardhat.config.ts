import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
// import "@matterlabs/hardhat-zksync-verify"; UNCOMMENT THIS AND INSTALL THIS PACKAGE TO VERIFY ZKSYNC

module.exports = {
  defaultNetwork: "mathMainnet",
  etherscan: {
    apiKey: {
      boba: "there_should_be_a_dummy_value_here_to_avoid_error",
      boba_goerli: "there_should_be_a_dummy_value_here_to_avoid_error",
      neon_devnet: "there_should_be_a_dummy_value_here_to_avoid_error",
      shimmer_testnet: "there_should_be_a_dummy_value_here_to_avoid_error",
    },
    customChains: [
      {
        chainId: 245_022_926,
        network: "neon_devnet",
        urls: {
          apiURL: "https://devnet-api.neonscan.org/hardhat/verify",
          browserURL: "https://devnet.neonscan.org",
        },
      },
      {
        chainId: 1071,
        network: "shimmer_testnet",
        urls: {
          apiURL: "https://explorer.evm.testnet.shimmer.network/api",
          browserURL: "https://explorer.evm.testnet.shimmer.network",
        },
      },
      {
        chainId: 288,
        network: "boba",
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/mainnet/evm/288/etherscan",
          browserURL: "https://boba.routescan.io",
        },
      },
      {
        chainId: 2888,
        network: "boba_goerli",
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/testnet/evm/2888/etherscan",
          browserURL: "https://boba.testnet.routescan.io",
        },
      },
    ],
  },
  networks: {
    abstract: {
      ethNetwork: "mainnet",
      url: "https://api.mainnet.abs.xyz",
      verifyURL:
        "https://api-explorer-verify.mainnet.abs.xyz/contract_verification",
      zksync: true,
    },
    abstractTestnet: {
      ethNetwork: "sepolia",
      url: "https://api.testnet.abs.xyz",
      verifyURL:
        "https://api-explorer-verify.testnet.abs.xyz/contract_verification",
      zksync: true,
    },
    cronosZkEvmMainnet: {
      ethNetwork: "sepolia", // or a Sepolia RPC endpoint from Infura/Alchemy/Chainstack etc.
      url: "https://mainnet.zkevm.cronos.org",
      verifyURL:
        "https://explorer-api.zkevm.cronos.org/api/v1/contract/verify/hardhat?apikey=",
      zksync: true,
    },
    cronosZkEvmTestnet: {
      ethNetwork: "sepolia", // or a Sepolia RPC endpoint from Infura/Alchemy/Chainstack etc.
      url: "https://testnet.zkevm.cronos.org",
      verifyURL: "https://explorer.zkevm.cronos.org/contract_verification",
      zksync: true,
    },
    mathMainnet: {
      ethNetwork: "mainnet",
      url: "https://redacted.master.dev/",
      verifyURL: "https://redacted.master.dev/contract_verification",
      zksync: true,
    },
    zkSyncMainnet: {
      chainId: 324,
      ethNetwork: "mainnet",
      url: "https://zksync2-mainnet.zksync.io",
      verifyURL:
        "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
      zksync: true,
    },
    // [process.env.MIGRATIONS_NETWORK!]: {
    //   url: process.env.RPC_URL,
    //   chainId: Number(process.env.NETWORK_ID),
    //   accounts: {
    //     mnemonic: process.env.MNEMONIC,
    //   },
    // },
    zkSyncTestnet: {
      chainId: 280,
      ethNetwork: "goerli", // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      url: "https://zksync2-testnet.zksync.dev", // URL of the zkSync network RPC
      verifyURL:
        "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
      zksync: true,
    },
  },
  solidity: {
    evmVersion: "paris",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
    version: "0.8.20",
  },
  zksolc: {
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
    version: "1.4.1",
  },
};

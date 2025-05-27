import { http } from "wagmi";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
// import "@matterlabs/hardhat-zksync-verify"; UNCOMMENT THIS AND INSTALL THIS PACKAGE TO VERIFY ZKSYNC

module.exports = {
  zksolc: {
    version: "1.4.1",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  defaultNetwork: "mathMainnet",
  networks: {
    // [process.env.MIGRATIONS_NETWORK!]: {
    //   url: process.env.RPC_URL,
    //   chainId: Number(process.env.NETWORK_ID),
    //   accounts: {
    //     mnemonic: process.env.MNEMONIC,
    //   },
    // },
    zkSyncTestnet: {
      url: "https://zksync2-testnet.zksync.dev", // URL of the zkSync network RPC
      ethNetwork: "goerli", // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      zksync: true,
      chainId: 280,
      verifyURL:
        "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
    },
    zkSyncMainnet: {
      url: "https://zksync2-mainnet.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      chainId: 324,
      verifyURL:
        "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
    },
    cronosZkEvmTestnet: {
      url: "https://testnet.zkevm.cronos.org",
      ethNetwork: "sepolia", // or a Sepolia RPC endpoint from Infura/Alchemy/Chainstack etc.
      zksync: true,
      verifyURL: "https://explorer.zkevm.cronos.org/contract_verification",
    },
    cronosZkEvmMainnet: {
      url: "https://mainnet.zkevm.cronos.org",
      ethNetwork: "sepolia", // or a Sepolia RPC endpoint from Infura/Alchemy/Chainstack etc.
      zksync: true,
      verifyURL:
        "https://explorer-api.zkevm.cronos.org/api/v1/contract/verify/hardhat?apikey=",
    },
    abstractTestnet: {
      url: "https://api.testnet.abs.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL:
        "https://api-explorer-verify.testnet.abs.xyz/contract_verification",
    },
    mathMainnet: {
      url: "https://redacted.master.dev/",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://redacted.master.dev/contract_verification",
    },
  },
  etherscan: {
    apiKey: {
      neon_devnet: "there_should_be_a_dummy_value_here_to_avoid_error",
      shimmer_testnet: "there_should_be_a_dummy_value_here_to_avoid_error",
      boba_goerli: "there_should_be_a_dummy_value_here_to_avoid_error",
      boba: "there_should_be_a_dummy_value_here_to_avoid_error",
    },
    customChains: [
      {
        network: "neon_devnet",
        chainId: 245022926,
        urls: {
          apiURL: "https://devnet-api.neonscan.org/hardhat/verify",
          browserURL: "https://devnet.neonscan.org",
        },
      },
      {
        network: "shimmer_testnet",
        chainId: 1071,
        urls: {
          apiURL: "https://explorer.evm.testnet.shimmer.network/api",
          browserURL: "https://explorer.evm.testnet.shimmer.network",
        },
      },
      {
        network: "boba",
        chainId: 288,
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/mainnet/evm/288/etherscan",
          browserURL: "https://boba.routescan.io",
        },
      },
      {
        network: "boba_goerli",
        chainId: 2888,
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/testnet/evm/2888/etherscan",
          browserURL: "https://boba.testnet.routescan.io",
        },
      },
    ],
  },
  solidity: {
    version: "0.8.29",
    evmVersion: "paris",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

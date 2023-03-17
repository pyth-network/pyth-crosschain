import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
// import "@matterlabs/hardhat-zksync-verify"; UNCOMMENT THIS AND INSTALL THIS PACKAGE TO VERIFY ZKSYNC

module.exports = {
  zksolc: {
    version: "1.3.1",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  defaultNetwork: "zkSyncTestnet",
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      zksync: false,
    },
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
    neon_devnet: {
      url: "https://devnet.neonevm.org",
      chainId: 245022926,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    shimmer_testnet: {
      url: "https://json-rpc.evm.testnet.shimmer.network",
      chainId: 1070,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
  etherscan: {
    apiKey: {
      neon_devnet: "there_should_be_a_dummy_value_here_to_avoid_error",
      shimmer_testnet: "there_should_be_a_dummy_value_here_to_avoid_error",
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
        chainId: 1070,
        urls: {
          apiURL: "https://explorer.evm.testnet.shimmer.network/api",
          browserURL: "https://explorer.evm.testnet.shimmer.network",
        },
      },
    ],
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
};

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
    [process.env.MIGRATIONS_NETWORK]: {
      provider: payerProvider(process.env.RPC_URL),
      network_id: process.env.NETWORK_ID,
    },
  },

  compilers: {
    solc: {
      version: "0.8.29",
      evmVersion: "paris",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  plugins: [
    "truffle-plugin-verify",
    "truffle-contract-size",
    "truffle-plugin-stdjsonin",
  ],
};

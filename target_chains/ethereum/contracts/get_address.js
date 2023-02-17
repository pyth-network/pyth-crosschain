const HDWalletProvider = require("@truffle/hdwallet-provider");

const wallet = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://rpc.public.zkevm-test.net/`,
});

console.log(wallet.getAddress(0));

import {MainnetConfig, TestnetConfig, AttesterConfigState, LocalDevnetConfig, getEvmDataSources, getAttesterConfig, Config} from "./config";
import {PublicKey} from "@solana/web3.js";
const DEFAULTS: Config = {
  mainnet: new MainnetConfig(),
  testnet: new TestnetConfig(
    {
      ethereum: {
        rpcUrl: "https://rpc.goerli.mudit.blog/",
        targetChainContract: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
      },
      aurora: {
        rpcUrl: "https://testnet.aurora.dev",
        targetChainContract: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
      },
      bnb: {
        rpcUrl: "https://bsctestapi.terminet.io/rpc",
        targetChainContract: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
      },
      solana: {
        rpcUrl: "https://api.devnet.solana.com",
        attesterContract: new PublicKey(
          "dnSeccJXMXPw3KQSodXRzN9oJQNj6rrU6Ztroean2Wq",
        ),
      },
      pythtest: {
        rpcUrl: "https://api.devnet.solana.com",
        attesterContract: new PublicKey(
          "dnSeccJXMXPw3KQSodXRzN9oJQNj6rrU6Ztroean2Wq",
        ),
      },
    },
  ),
  localDevnet: new LocalDevnetConfig({
    ethereum: {
      rpcUrl: "http://localhost:8545",
      targetChainContract: "0xe982E462b094850F12AF94d21D470e21bE9D0E9C",
    },
    solana: {
      rpcUrl: "http://localhost:8899",
      attesterContract: new PublicKey(
        "P2WH424242424242424242424242424242424242424",
      ),
    },
  }),
};

// Main routine
(async () => {
  let dataSources = await getEvmDataSources(DEFAULTS.testnet.ethereum);
  console.log("Ethereum data sources: ", dataSources);
  let attesterCfg = await getAttesterConfig(DEFAULTS.testnet.solana);

  console.log("Attester config: ", attesterCfg);
})();

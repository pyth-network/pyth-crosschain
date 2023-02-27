// npx pretty-quick

const nearAPI = require("near-api-js");
const BN = require("bn.js");
const fs = require("fs");
const fetch = require("node-fetch");
import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";
const { parseSeedPhrase, generateSeedPhrase } = require("near-seed-phrase");

function getConfig(env: any) {
  switch (env) {
    case "sandbox":
    case "local":
      return {
        networkId: "sandbox",
        nodeUrl: "http://localhost:3030",
        masterAccount: "test.near",
        pythAccount: "pyth.test.near",
        tokenAccount: "token.test.near",
        nftAccount: "nft.test.near",
        testAccount: "test.test.near",
      };
    case "testnet":
      return {
        networkId: "testnet",
        nodeUrl: "https://rpc.testnet.near.org",
        masterAccount: "pyth.testnet",
        pythAccount: "pyth.pyth.testnet",
        tokenAccount: "token.pyth.testnet",
        nftAccount: "nft.pyth.testnet",
        testAccount: "test.pyth.testnet",
      };
  }
  return {};
}

async function initNear() {
  let e = process.env.NEAR_ENV || "sandbox";
  let config = getConfig(e);

  // Retrieve the validator key directly in the Tilt environment
  const response = await fetch("http://localhost:3031/validator_key.json");
  const keyFile = await response.json();
  const masterKey = nearAPI.utils.KeyPair.fromString(
    keyFile.secret_key || keyFile.private_key
  );

  let keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  keyStore.setKey(config.networkId, config.masterAccount, masterKey);

  let near = await nearAPI.connect({
    keyStore,
    networkId: config.networkId,
    nodeUrl: config.nodeUrl,
  });

  let masterAccount = new nearAPI.Account(
    near.connection,
    config.masterAccount
  );

  console.log(
    "Finish init NEAR masterAccount: " +
      JSON.stringify(await masterAccount.getAccountBalance())
  );

  const deposit = parseSeedPhrase(
    "weather opinion slam purpose access artefact word orbit matter rice poem badge"
  );
  const response = await masterAccount.createAccount(
    "devnet.test.near",
    response.publicKey,
    new BN(10).pow(new BN(27))
  );

  console.log("Key: devnet.test.near funded");

  const pythContract = await fs.readFileSync("./pyth.wasm");
  keyStore.setKey(config.networkId, config.pythAccount, masterKey);

  console.log("Deploying Core/Pyth contract: " + config.pythAccount);

  pythAccount = await masterAccount.createAndDeployContract(
    config.pythAccount,
    masterKey.getPublicKey(),
    pythContract,
    new BN("20000000000000000000000000")
  );
}

initNear();

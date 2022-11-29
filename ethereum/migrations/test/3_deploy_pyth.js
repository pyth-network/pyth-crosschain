const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

const bs58 = require("bs58");

const PythUpgradable = artifacts.require("PythUpgradable");
const Wormhole = artifacts.require("Wormhole");

const pyth2WormholeChainId = process.env.SOLANA_CHAIN_ID;
const pyth2WormholeEmitter = process.env.SOLANA_EMITTER;
const validTimePeriodSeconds = Number(process.env.VALID_TIME_PERIOD_SECONDS);
const singleUpdateFeeInWei = Number(process.env.SINGLE_UPDATE_FEE_IN_WEI);

const { deployProxy } = require("@openzeppelin/truffle-upgrades");

console.log(
  "Deploying Pyth with emitter",
  pyth2WormholeEmitter.toString("hex")
);

module.exports = async function (deployer) {
  // Deploy the proxy script
  await deployProxy(
    PythUpgradable,
    [
      (await Wormhole.deployed()).address,
      [pyth2WormholeChainId],
      [pyth2WormholeEmitter],
      validTimePeriodSeconds,
      singleUpdateFeeInWei,
    ],
    { deployer }
  );
};

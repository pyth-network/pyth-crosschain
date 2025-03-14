require("dotenv").config();

const bs58 = require("bs58");

const PythUpgradable = artifacts.require("PythUpgradable");
const Wormhole = artifacts.require("Wormhole");

const pyth2WormholeChainId = process.env.SOLANA_CHAIN_ID;
const pyth2WormholeEmitter = process.env.SOLANA_EMITTER;

const governanceChainId = process.env.GOVERNANCE_CHAIN_ID;
const governanceEmitter = process.env.GOVERNANCE_EMITTER;
// Default value for this field is 0
const governanceInitialSequence = Number(
  process.env.GOVERNANCE_INITIAL_SEQUENCE ?? "0",
);

const validTimePeriodSeconds = Number(process.env.VALID_TIME_PERIOD_SECONDS);
const singleUpdateFeeInWei = Number(process.env.SINGLE_UPDATE_FEE_IN_WEI);

const { deployProxy } = require("@openzeppelin/truffle-upgrades");

console.log("pyth2WormholeChainId: " + pyth2WormholeChainId);
console.log("pyth2WormholeEmitter: " + pyth2WormholeEmitter);
console.log("governanceEmitter: " + governanceEmitter);
console.log("governanceChainId: " + governanceChainId);
console.log("governanceInitialSequence: " + governanceInitialSequence);
console.log("validTimePeriodSeconds: " + validTimePeriodSeconds);
console.log("singleUpdateFeeInWei: " + singleUpdateFeeInWei);

module.exports = async function (deployer) {
  // Deploy the proxy script
  await deployProxy(
    PythUpgradable,
    [
      (await Wormhole.deployed()).address,
      [pyth2WormholeChainId],
      [pyth2WormholeEmitter],
      governanceChainId,
      governanceEmitter,
      governanceInitialSequence,
      validTimePeriodSeconds,
      singleUpdateFeeInWei,
    ],
    { deployer },
  );
};

const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const PythUpgradable = artifacts.require("PythUpgradable");
const governanceChainId = process.env.GOVERNANCE_CHAIN_ID;
const governanceEmitter = process.env.GOVERNANCE_EMITTER;

console.log("governanceEmitter: " + governanceEmitter);
console.log("governanceChainId: " + governanceChainId);

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Version 1.1.0
 * 
 * This change:
 * - Use pyth-sdk-solidity 1.0.0 which simplifies the PriceFeed interface
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
}

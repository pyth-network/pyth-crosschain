require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");
const governanceChainId = process.env.GOVERNANCE_CHAIN_ID;
const governanceEmitter = process.env.GOVERNANCE_EMITTER;

console.log("governanceEmitter: " + governanceEmitter);
console.log("governanceChainId: " + governanceChainId);

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Version 1.0.0 - 2nd step
 * 
 * This change:
 * - Renounce single ownership, the contract will be managed by only the governance
 */
module.exports = async function (_deployer) {
    const proxy = await PythUpgradable.deployed();
    await proxy.renounceOwnership();
}

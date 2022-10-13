const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

const PythUpgradable = artifacts.require("PythUpgradable");
const governanceChainId = process.env.GOVERNANCE_CHAIN_ID;
const governanceEmitter = process.env.GOVERNANCE_EMITTER;

console.log("governanceEmitter: " + governanceEmitter);
console.log("governanceChainId: " + governanceChainId);

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Version 1.0.0 - 1st step
 * 
 * This change:
 * - Moves away single ownership to Governance coming from the Wormhole to
 *   manage the contract.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
    await proxy.updateGovernanceDataSource(governanceChainId, governanceEmitter, 0);
}

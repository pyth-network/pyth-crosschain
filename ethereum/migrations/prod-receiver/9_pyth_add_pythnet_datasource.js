require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const pythnetChainId = process.env.PYTHNET_CHAIN_ID;
const pythnetEmitter = process.env.PYTHNET_EMITTER;

console.log("pythnetEmitter: " + pythnetEmitter);
console.log("pythnetChainId: " + pythnetChainId);

/**
 * This change:
 * - Adds PythNet data source.
 */
module.exports = async function (_deployer) {
    const proxy = await PythUpgradable.deployed();
    await proxy.addDataSource(
        pythnetChainId,
        pythnetEmitter,
    );
}

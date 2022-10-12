const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Version 0.1.0
 * 
 * This change:
 * - Updates the interface, adds `updatePriceFeedsIfNecessary` that wraps
 *   `updatePriceFeeds` and rejects if the price update is not necessary. 
 * - Changes some memory modifiers to improve gas efficiency.
 * - Changes staleness logic to be included in the sdk and bring
 *   more clarity to the existing code.
 * - Adds version to the contract (which is hard coded)
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
}

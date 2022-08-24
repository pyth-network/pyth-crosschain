require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * This change:
 * - Updates the interface, adds `updatePriceFeedsIfNecessary` that wraps
 *   `updatePriceFeeds` and rejects if the price update is not necessary. 
 * - Change some memory modifiers to improve gas efficiency.
 * - Change staleness logic to be included in the sdk and bring
 *   more clarity to the existing code.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer });
}

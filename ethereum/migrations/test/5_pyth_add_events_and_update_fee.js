require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * This change:
 * - Adds fee for updating prices. Default value in Ethereum is 0, so the value after upgrade will be 0.
 * - Emits multiple events when a price gets updated. This can be used by off-chain applications to monitor
 *   the contract activity.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
}

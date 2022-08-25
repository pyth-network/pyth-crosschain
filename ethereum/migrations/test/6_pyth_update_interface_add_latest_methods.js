require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * This change:
 * - Updates the interface, removes `getPrevPriceUnsafe` and adds two functions
 *   `getLatestAvailablePriceUnsafe` and `getLatestAvailablePriceWithinDuration`
 *   to replace its behaviour in a more elegant way.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
}

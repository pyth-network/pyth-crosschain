require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Adds multiple emitter/chain ID support
 */
module.exports = async function (deployer) {
    const instance = await PythUpgradable.deployed();
    await upgradeProxy(instance.address, PythUpgradable, { deployer, call: "migrateMultiSources" });
}

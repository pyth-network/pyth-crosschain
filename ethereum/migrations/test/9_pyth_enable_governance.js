require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");


const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Version 1.0.0
 * 
 * This change:
 * - Moves away single ownership to Governance coming from the Wormhole
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer });
    await proxy.renounceOwnership();
}

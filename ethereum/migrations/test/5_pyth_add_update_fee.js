require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * This change adds fee for updating prices. As it is intended to keep the fee 0 and default value in Ethereum is 0,
 * this migration only upgrades the contract and does not set the value. 
 */
module.exports = async function (deployer) {
    const instance = await PythUpgradable.deployed();
    await upgradeProxy(instance.address, PythUpgradable, { deployer });
}

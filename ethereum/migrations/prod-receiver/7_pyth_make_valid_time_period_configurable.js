const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const PythUpgradable = artifacts.require("PythUpgradable");
const validTimePeriodSeconds = Number(process.env.VALID_TIME_PERIOD_SECONDS);

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * This change:
 * - Makes validTimePeriodSeconds configurable and sets its value.
 *   The value depends on the network latency and block time. So
 *   it is read from the network env file.
 * 
 * During this upgrade two transaction will be sent and in between validTimePeriodSeconds
 * will be zero and `getCurrentPrice` will reject. At the time of doing this migration
 * Pyth is not deployed on mainnet and current hard-coded value is large for some
 * networks and it's better to reject rather than accept a price old in the past.
 * 
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });

    await proxy.updateValidTimePeriodSeconds(validTimePeriodSeconds);
}

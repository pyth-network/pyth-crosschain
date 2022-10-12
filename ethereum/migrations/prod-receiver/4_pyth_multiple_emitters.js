const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Adds multiple emitter/chain ID support
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });
    await proxy.addDataSource(
        await proxy.pyth2WormholeChainId(),
        await proxy.pyth2WormholeEmitter()
    );
};

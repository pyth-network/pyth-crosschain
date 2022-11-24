const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Adds multiple emitter/chain ID support
 */
module.exports = async function (deployer) {
  const proxy = await PythUpgradable.deployed();
  await upgradeProxy(proxy.address, PythUpgradable, {
    deployer,
    unsafeSkipStorageCheck: true,
  });
  await proxy.addDataSource(
    await proxy.pyth2WormholeChainId(),
    await proxy.pyth2WormholeEmitter()
  );
};

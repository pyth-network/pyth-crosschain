const Migrations = artifacts.require("Migrations");

const tdr = require("truffle-deploy-registry");

module.exports = async function (deployer, network) {
  await deployer.deploy(Migrations);
  let migrationsInstance = await Migrations.deployed();

  if (!tdr.isDryRunNetworkName(network)) {
    await tdr.appendInstance(migrationsInstance);
  }
};

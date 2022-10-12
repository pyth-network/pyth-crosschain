const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const setFeeVaa = process.env.MIGRATION_12_SET_FEE_VAA;
console.log("Set fee vaa: ", setFeeVaa);

const PythUpgradable = artifacts.require("PythUpgradable");

/**
 * 
 * This change:
 * - Executes the VAA to set the fee to 1 wei
 */
module.exports = async function (_deployer) {
    const proxy = await PythUpgradable.deployed();
    await proxy.executeGovernanceInstruction(setFeeVaa);
}

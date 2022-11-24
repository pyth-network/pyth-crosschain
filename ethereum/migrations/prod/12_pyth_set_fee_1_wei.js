const governance = require("@pythnetwork/xc-governance-sdk");
const assertVaaPayloadEquals = require("../../scripts/assertVaaPayloadEquals");
const { assert } = require("chai");

const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

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

  const setFeeInstruction = new governance.SetFeeInstruction(
    governance.CHAINS.unset, // All the chains
    BigInt(1),
    BigInt(0)
  ).serialize();

  console.log("SetFeeInstruction: 0x", setFeeInstruction.toString("hex"));

  assertVaaPayloadEquals(setFeeVaa, setFeeInstruction);

  await proxy.executeGovernanceInstruction(setFeeVaa);

  assert.equal((await proxy.singleUpdateFeeInWei()).toString(), "1");
};

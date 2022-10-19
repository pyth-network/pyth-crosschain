const createLocalnetGovernanceVaa = require("../../scripts/createLocalnetGovernanceVaa");
const assertVaaPayloadEquals = require("../../scripts/assertVaaPayloadEquals");
const governance = require("@pythnetwork/xc-governance-sdk");
const { assert } = require("chai");

const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");


const PythUpgradable = artifacts.require("PythUpgradable");

/**
 * 
 * This change:
 * - Executes the VAA to set the fee to 1 wei
 */
module.exports = async function (_deployer) {
    const setFeeInstruction = new governance.SetFeeInstruction(
        governance.CHAINS.unset, // All the chains
        BigInt(1),
        BigInt(0),
    ).serialize();

    console.log("SetFeeInstruction: 0x", setFeeInstruction.toString('hex'));

    const setFeeVaa = createLocalnetGovernanceVaa(
        setFeeInstruction,
        2
    );

    assertVaaPayloadEquals(setFeeVaa, setFeeInstruction);

    const proxy = await PythUpgradable.deployed();
    await proxy.executeGovernanceInstruction(setFeeVaa);

    assert.equal((await proxy.singleUpdateFeeInWei()).toString(), "1");
}

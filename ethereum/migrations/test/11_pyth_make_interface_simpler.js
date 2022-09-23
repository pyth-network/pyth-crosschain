require('dotenv').config({ path: "../.env" });

const governance = require("@pythnetwork/xc-governance-sdk");
const createLocalnetGovernanceVaa = require("../../scripts/createLocalnetGovernanceVaa");

const PythUpgradable = artifacts.require("PythUpgradable");
const governanceChainId = process.env.GOVERNANCE_CHAIN_ID;
const governanceEmitter = process.env.GOVERNANCE_EMITTER;

console.log("governanceEmitter: " + governanceEmitter);
console.log("governanceChainId: " + governanceChainId);

const { deployProxyImpl } = require('@openzeppelin/truffle-upgrades/dist/utils');

/**
 * Version 1.1.0
 * 
 * This change:
 * - Use pyth-sdk-solidity 1.0.0 which simplifies the PriceFeed interface
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    const newImpl = (await deployProxyImpl(PythUpgradable, { deployer, unsafeSkipStorageCheck: true }, proxy.address)).impl;
    console.log(newImpl);

    await proxy.executeGovernanceInstruction(
        createLocalnetGovernanceVaa(
            new governance.EthereumUpgradeContractInstruction(
                governance.CHAINS.ethereum,
                new governance.HexString20Bytes(newImpl)
            ).serialize(),
            1,
        )
    );
}

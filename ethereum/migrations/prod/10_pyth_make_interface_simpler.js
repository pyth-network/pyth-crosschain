require('dotenv').config({ path: "../.env" });

const governance = require("@pythnetwork/xc-governance-sdk");

const PythUpgradable = artifacts.require("PythUpgradable");
const wormholeChainName = process.env.WORMHOLE_CHAIN_NAME;

const { deployProxyImpl } = require('@openzeppelin/truffle-upgrades/dist/utils');
const { assert } = require('chai');

/**
 * Version 1.1.0
 * 
 * This change:
 * - Use pyth-sdk-solidity 1.0.0 which simplifies the PriceFeed interface
 */
module.exports = async function (deployer) {
    assert(governance.CHAINS[wormholeChainName] !== undefined);

    const proxy = await PythUpgradable.deployed();
    const newImpl = (await deployProxyImpl(PythUpgradable, { deployer, unsafeSkipStorageCheck: true }, proxy.address)).impl;
    console.log(`New implementation address is: ${newImpl}. Please sign and execute the following encoded ` +
        `governance instruction to upgrade it.`);

    const instructionBuffer = new governance.EthereumUpgradeContractInstruction(
        governance.CHAINS[wormholeChainName],
        new governance.HexString20Bytes(newImpl)
    ).serialize();
    console.log(`Governance instruction: 0x${instructionBuffer.toString('hex')}`);
}

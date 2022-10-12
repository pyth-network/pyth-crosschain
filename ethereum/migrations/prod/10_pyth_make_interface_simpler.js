const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

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
    await upgradeProxy(proxy.address, PythUpgradable, { deployer, unsafeSkipStorageCheck: true });

    // This step is not needed in new contracts as the contract up to this step is up to date.
    // The code is left here to be an example of how to create a governance instruction for upgrade.
    // If you wish to create an upgrade step, do it in 2 migration steps. First step should be like below
    // that deploys a new contract and creates the governance instruction payload. Second step should
    // take the VAA as an env variable and execute it.
    
    // const proxy = await PythUpgradable.deployed();
    // const newImpl = (await deployProxyImpl(PythUpgradable, { deployer, unsafeSkipStorageCheck: true }, proxy.address)).impl;
    // console.log(`New implementation address is: ${newImpl}. Please sign and execute the following encoded ` +
    //     `governance instruction to upgrade it.`);

    // const instructionBuffer = new governance.EthereumUpgradeContractInstruction(
    //     governance.CHAINS[wormholeChainName],
    //     new governance.HexString20Bytes(newImpl)
    // ).serialize();
    // console.log(`Governance instruction: 0x${instructionBuffer.toString('hex')}`);
}

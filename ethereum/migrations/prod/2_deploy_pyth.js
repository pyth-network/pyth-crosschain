const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

const PythUpgradable = artifacts.require("PythUpgradable");

const pyth2WormholeChainId = process.env.SOLANA_CHAIN_ID;
const pyth2WormholeEmitter = process.env.SOLANA_EMITTER;

const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const tdr = require('truffle-deploy-registry');
const { CONTRACTS } = require('@certusone/wormhole-sdk');
const { assert } = require("chai");

console.log("pyth2WormholeEmitter: " + pyth2WormholeEmitter)
console.log("pyth2WormholeChainId: " + pyth2WormholeChainId)

module.exports = async function (deployer, network) {
    const cluster = process.env.CLUSTER;
    const chainName = process.env.WORMHOLE_CHAIN_NAME;

    assert(cluster !== undefined && chainName !== undefined);

    const wormholeBridgeAddress = CONTRACTS[cluster.toUpperCase()][chainName].core;
    assert(wormholeBridgeAddress !== undefined);

    console.log("Wormhole bridge address: " + wormholeBridgeAddress)

    // Deploy the proxy. This will return an instance of PythUpgradable,
    // with the address field corresponding to the fronting ERC1967Proxy.
    let proxyInstance = await deployProxy(PythUpgradable,
        [
            wormholeBridgeAddress,
            pyth2WormholeChainId,
            pyth2WormholeEmitter
        ],
        { deployer });

    // Add the ERC1967Proxy address to the PythUpgradable contract's 
    // entry in the registry. This allows us to call upgradeProxy
    // functions with the value of PythUpgradable.deployed().address:
    // e.g. upgradeProxy(PythUpgradable.deployed().address, NewImplementation)
    if (!tdr.isDryRunNetworkName(network)) {
        await tdr.appendInstance(proxyInstance);
    }
};

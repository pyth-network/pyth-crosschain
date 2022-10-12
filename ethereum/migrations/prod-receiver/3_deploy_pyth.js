const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const PythUpgradable = artifacts.require("PythUpgradable");
const WormholeReceiver = artifacts.require("WormholeReceiver");

const pyth2WormholeChainId = process.env.SOLANA_CHAIN_ID;
const pyth2WormholeEmitter = process.env.SOLANA_EMITTER;

const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const tdr = require('truffle-deploy-registry');

console.log("pyth2WormholeEmitter: " + pyth2WormholeEmitter)
console.log("pyth2WormholeChainId: " + pyth2WormholeChainId)

module.exports = async function (deployer, network) {
    // Deploy the proxy. This will return an instance of PythUpgradable,
    // with the address field corresponding to the fronting ERC1967Proxy.
    let proxyInstance = await deployProxy(PythUpgradable,
        [
            (await WormholeReceiver.deployed()).address,
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

require('dotenv').config({ path: "../.env" });
const bs58 = require("bs58");

const PythUpgradable = artifacts.require("PythUpgradable");
const Wormhole = artifacts.require("Wormhole");

const chainId = process.env.PYTH_INIT_CHAIN_ID;
const pyth2WormholeChainId = process.env.PYTH_TO_WORMHOLE_CHAIN_ID;
const pyth2WormholeEmitter = bs58.decode(process.env.PYTH_TO_WORMHOLE_EMITTER); // base58, must fit into bytes32

const { deployProxy } = require("@openzeppelin/truffle-upgrades");

console.log("Deploying Pyth with emitter", pyth2WormholeEmitter.toString("hex"))

module.exports = async function (deployer) {
    // Deploy the proxy script
    await deployProxy(PythUpgradable,
        [
            chainId,
            (await Wormhole.deployed()).address,
            pyth2WormholeChainId,
            "0x" + pyth2WormholeEmitter.toString("hex")
        ],
        { deployer });
};

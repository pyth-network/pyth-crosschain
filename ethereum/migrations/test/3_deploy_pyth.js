const dotenv = require("dotenv")
dotenv.config({ path: "../../.env" });

if (process.env.CLUSTER !== undefined) {
  dotenv.config({ path: `../../.env.cluster.${process.env.CLUSTER}`});
}

const bs58 = require("bs58");

const PythUpgradable = artifacts.require("PythUpgradable");
const Wormhole = artifacts.require("Wormhole");

const pyth2WormholeChainId = process.env.SOLANA_CHAIN_ID;
const pyth2WormholeEmitter = process.env.SOLANA_EMITTER;

const { deployProxy } = require("@openzeppelin/truffle-upgrades");

console.log("Deploying Pyth with emitter", pyth2WormholeEmitter.toString("hex"))

module.exports = async function (deployer) {
    // Deploy the proxy script
    await deployProxy(PythUpgradable,
        [
            (await Wormhole.deployed()).address,
            pyth2WormholeChainId,
            pyth2WormholeEmitter
        ],
        { deployer });
};

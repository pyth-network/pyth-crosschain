const loadEnv = require("../../scripts/loadEnv");
loadEnv("../../");

const tdr = require("truffle-deploy-registry");
const governance = require("xc_admin_common");
const { assert } = require("chai");

const ReceiverSetup = artifacts.require("ReceiverSetup");
const ReceiverImplementation = artifacts.require("ReceiverImplementation");
const WormholeReceiver = artifacts.require("WormholeReceiver");
const { getDefaultConfig } = require("../../scripts/contractManagerConfig");

// CONFIG

const chainName = process.env.WORMHOLE_CHAIN_NAME;
assert(chainName !== undefined);

const wormholeReceiverChainId = governance.CHAINS[chainName];
assert(wormholeReceiverChainId !== undefined);

const {
  wormholeGovernanceChainId,
  wormholeGovernanceContract,
  wormholeInitialSigners,
} = getDefaultConfig(process.env.MIGRATIONS_NETWORK);

module.exports = async function (deployer, network) {
  // deploy setup
  await deployer.deploy(ReceiverSetup);

  // deploy implementation
  await deployer.deploy(ReceiverImplementation);

  // encode initialisation data
  const setup = new web3.eth.Contract(ReceiverSetup.abi, ReceiverSetup.address);
  const initData = setup.methods
    .setup(
      ReceiverImplementation.address,
      wormholeInitialSigners,
      wormholeReceiverChainId,
      wormholeGovernanceChainId,
      wormholeGovernanceContract
    )
    .encodeABI();

  // deploy proxy
  const wormholeReceiver = await deployer.deploy(
    WormholeReceiver,
    ReceiverSetup.address,
    initData
  );

  if (!tdr.isDryRunNetworkName(network)) {
    await tdr.appendInstance(wormholeReceiver);
  }
};

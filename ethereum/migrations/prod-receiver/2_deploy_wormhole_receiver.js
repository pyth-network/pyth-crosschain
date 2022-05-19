require("dotenv").config({ path: "../.env" });

const ReceiverSetup = artifacts.require("ReceiverSetup");
const ReceiverImplementation = artifacts.require("ReceiverImplementation");
const WormholeReceiver = artifacts.require("WormholeReceiver");

// CONFIG
const initialSigners = JSON.parse(process.env.INIT_SIGNERS);
const governanceChainId = process.env.INIT_GOV_CHAIN_ID;
const governanceContract = process.env.INIT_GOV_CONTRACT; // bytes32

module.exports = async function (deployer) {
  // deploy setup
  await deployer.deploy(ReceiverSetup);

  // deploy implementation
  await deployer.deploy(ReceiverImplementation);

  // encode initialisation data
  const setup = new web3.eth.Contract(ReceiverSetup.abi, ReceiverSetup.address);
  const initData = setup.methods
    .setup(
      ReceiverImplementation.address,
      initialSigners,
      governanceChainId,
      governanceContract
    )
    .encodeABI();

  // deploy proxy
  await deployer.deploy(WormholeReceiver, ReceiverSetup.address, initData);
};

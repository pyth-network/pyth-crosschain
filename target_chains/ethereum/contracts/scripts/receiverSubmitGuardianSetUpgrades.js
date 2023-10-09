// run this script with truffle exec
const WormholeReceiver = artifacts.require("WormholeReceiver");

const { WormholeEvmContract, DefaultStore } = require("contract_manager");
const { Wallet } = require("ethers");
module.exports = async function (callback) {
  try {
    const contract = new WormholeEvmContract(
      DefaultStore.chains[process.env.MIGRATIONS_NETWORK],
      WormholeReceiver.address
    );
    const wallet = Wallet.fromMnemonic(process.env.MNEMONIC);
    const privateKey = wallet.privateKey.replace("0x", "");
    await contract.syncMainnetGuardianSets(privateKey);
    console.log("Updated the guardian set successfully.");
    callback();
  } catch (e) {
    callback(e);
  }
};

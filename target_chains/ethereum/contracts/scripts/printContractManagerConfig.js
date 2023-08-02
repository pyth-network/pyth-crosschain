const { EvmChain, EvmContract, Store } = require("contract_manager/lib");
module.exports = function printConfig() {
  const mainnet = process.env.CLUSTER === "mainnet";
  const wormholeChainName = process.env.WORMHOLE_CHAIN_NAME;
  const chain = new EvmChain(
    process.env.MIGRATIONS_NETWORK,
    mainnet,
    wormholeChainName,
    process.env.RPC_URL,
    Number(process.env.NETWORK_ID)
  );
  const contract = new EvmContract(chain, proxyInstance.address);
  console.log("Add the following to your evm chain configs");
  console.log(Store.serialize(chain));
  console.log("Add the following to your evm contract configs");
  console.log(Store.serialize(contract));
};

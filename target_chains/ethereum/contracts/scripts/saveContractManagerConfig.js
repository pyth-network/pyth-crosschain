const { EvmContract, DefaultStore, Store } = require("contract_manager/lib");
module.exports = function saveConfig(chainName, address) {
  const chain = DefaultStore.chains[chainName];
  const contract = new EvmContract(chain, address);
  DefaultStore.contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
  console.log("Added the following to your evm contract configs");
  console.log(Store.serialize(contract));
};

const {
  EvmContract,
  DefaultStore,
  Store,
  getDefaultDeploymentConfig,
} = require("@pythnetwork/contract-manager");

function convertAddress(address) {
  return "0x" + address;
}

function convertChainId(number) {
  return "0x" + number.toString(16);
}

function getDefaultConfig(chainName) {
  const chain = DefaultStore.chains[chainName];
  console.log("***chain", chain);
  const { dataSources, governanceDataSource, wormholeConfig } =
    getDefaultDeploymentConfig("stable");

  const emitterChainIds = dataSources.map((dataSource) =>
    convertChainId(dataSource.emitterChain),
  );
  const emitterAddresses = dataSources.map((dataSource) =>
    convertAddress(dataSource.emitterAddress),
  );
  const governanceChainId = convertChainId(governanceDataSource.emitterChain);
  const governanceEmitter = convertAddress(governanceDataSource.emitterAddress);

  const wormholeInitialSigners =
    wormholeConfig.initialGuardianSet.map(convertAddress);
  const wormholeGovernanceChainId = convertChainId(
    wormholeConfig.governanceChainId,
  );
  const wormholeGovernanceContract = convertAddress(
    wormholeConfig.governanceContract,
  );

  return {
    governanceEmitter,
    governanceChainId,
    emitterAddresses,
    emitterChainIds,
    wormholeInitialSigners,
    wormholeGovernanceChainId,
    wormholeGovernanceContract,
  };
}
function saveConfig(chainName, address) {
  const chain = DefaultStore.chains[chainName];
  const contract = new EvmContract(chain, address);
  DefaultStore.contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
  console.log("Added the following to your evm contract configs");
  console.log(Store.serialize(contract));
}

module.exports = { saveConfig, getDefaultConfig };

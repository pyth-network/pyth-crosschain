const {
  EvmContract,
  DefaultStore,
  Store,
  getDefaultDeploymentConfig,
} = require("contract_manager");

function convertAddress(address) {
  return "0x" + address;
}

function convertChainId(number) {
  return "0x" + number.toString(16);
}

function getDefaultConfig(_chainName) {
  const { dataSources, governanceDataSource, wormholeConfig } =
    getDefaultDeploymentConfig(process.env.CHANNEL);

  const emitterChainIds = dataSources.map((dataSource) =>
    convertChainId(dataSource.emitterChain)
  );
  const emitterAddresses = dataSources.map((dataSource) =>
    convertAddress(dataSource.emitterAddress)
  );
  const governanceChainId = convertChainId(governanceDataSource.emitterChain);
  const governanceEmitter = convertAddress(governanceDataSource.emitterAddress);

  const wormholeInitialSigners =
    wormholeConfig.initialGuardianSet.map(convertAddress);
  const wormholeGovernanceChainId = convertChainId(
    wormholeConfig.governanceChainId
  );
  const wormholeGovernanceContract = convertAddress(
    wormholeConfig.governanceContract
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

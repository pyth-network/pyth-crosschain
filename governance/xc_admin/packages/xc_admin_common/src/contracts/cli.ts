import {ContractType, loadFromConfig} from "./Contract";

const contractsConfig = [
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "arbitrum",
    address: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  },
  {
    type: ContractType.EvmWormholeReceiver,
    networkId: "canto",
    address: "0x87047526937246727E4869C5f76A347160e08672",
  },
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "canto",
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  },
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "avalanche",
    address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  }
]

const networksConfig = {
  evm: {
    optimism_goerli: {
      url: `https://rpc.ankr.com/optimism_testnet`,
      // TODO:
      network_id: 420,
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
      network_id: "0xa4b1",
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      network_id: "0xa86a",
    },
    canto: {
      url: 'https://canto.gravitychain.io',
      network_id: 7700
    }
  }
}

async function main() {
  const contracts = loadFromConfig(contractsConfig, networksConfig);

  for (const contract of contracts) {
    const state = await contract.getState();
    console.log({
      networkId: contract.networkId,
      address: contract.getAddress(),
      type: contract.type,
      state: state,
    });
  }
}

main();

import { ContractType } from "xc_admin_common/lib/contracts/Contract";
import { loadContractConfig } from "xc_admin_common/lib/contracts/config";

// TODO: load these from files
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
  },
];

const networksConfig = {
  evm: {
    optimism_goerli: {
      url: `https://rpc.ankr.com/optimism_testnet`,
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
    },
    canto: {
      url: "https://canto.gravitychain.io",
    },
  },
};

const multisigs = [
  {
    name: "",
    wormholeNetwork: "mainnet",
  },
];

async function main() {
  const contracts = loadContractConfig(contractsConfig, networksConfig);

  for (const contract of contracts) {
    const state = await contract.getState();
    console.log({
      networkId: contract.networkId,
      address: contract.getAddress(),
      type: contract.type,
      state: state,
    });
  }

  const state = await contracts[0].getState();
  state["validTimePeriod"] = 30;

  const ops = await contracts[0].sync(state);
  for (const op of ops) {
    console.log(op);
  }
}

main();

import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Contract, ContractType, NetworkId } from "./Contract";
import { EvmPythUpgradable } from "./EvmPythUpgradable";
import { EvmWormholeReceiver } from "./EvmWormholeReceiver";

export function getEvmProvider(
  networkId: NetworkId,
  networksConfig: any
): ethers.providers.Provider {
  const networkConfig = networksConfig["evm"][networkId]!;
  return ethers.getDefaultProvider(networkConfig.url);
}

export function loadContractConfig(
  contractsConfig: any,
  networksConfig: any
): Contract<any>[] {
  const contracts = [];
  for (const contractConfig of contractsConfig) {
    contracts.push(fromConfig(contractConfig, networksConfig));
  }
  return contracts;
}

function fromConfig(contractConfig: any, networksConfig: any): Contract<any> {
  switch (contractConfig.type) {
    case ContractType.EvmPythUpgradable: {
      const ethersContract = new ethers.Contract(
        contractConfig.address,
        PythAbi,
        getEvmProvider(contractConfig.networkId, networksConfig)
      );

      return new EvmPythUpgradable(
        contractConfig.networkId,
        contractConfig.address,
        ethersContract
      );
    }
    case ContractType.EvmWormholeReceiver: {
      const ethersContract = new ethers.Contract(
        contractConfig.address,
        // TODO: pass in an appropriate ABI here
        [],
        getEvmProvider(contractConfig.networkId, networksConfig)
      );

      return new EvmWormholeReceiver(
        contractConfig.networkId,
        contractConfig.address,
        ethersContract
      );
    }
    default:
      throw new Error(`unknown contract type: ${contractConfig.type}`);
  }
}

/** A contract is the basic unit that is managed by xc_admin. */
import {ChainId, RECEIVER_CHAINS} from "@pythnetwork/xc-governance-sdk";
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";

export enum ContractType {
  Oracle,
  EvmPythUpgradable,
  EvmWormholeReceiver,
}

// A unique identifier for a blockchain. Note that this does not exactly line up to ChainId, which currently reuses
// some ids across mainnet / testnet chains (e.g., ethereum goerli has the same id as ethereum mainnet).
export type NetworkId = string;

export interface Contract {
  type: ContractType,
  networkId: NetworkId,
  // note: not a unified format across chains
  getAddress(): string,
  // Must return an object that can be rendered as JSON
  getState(): Promise<any>,
}

export class EvmTargetChainContract implements Contract {
  public type = ContractType.EvmPythUpgradable;
  public networkId;
  private address;

  private contract: ethers.Contract;

  constructor(networkId: NetworkId, address: string, contract: ethers.Contract) {
    this.networkId = networkId;
    this.address = address;
    this.contract = contract;
  }

  public getAddress() {
    return this.address;
  }

  public async getState(): Promise<any> {
    const bytecodeSha = ethers.sha256(await this.contract.getDeployedCode() as string);
    const validTimePeriod = (await this.contract['getValidTimePeriod'].staticCallResult())[0];
    // TODO: add more state info here -- this will need the full PythUpgradable ABI
    return {
      bytecodeSha,
      validTimePeriod,
    };
  }
}

export class EvmWormholeReceiver implements Contract {
  public type = ContractType.EvmWormholeReceiver;
  public networkId;
  private address;

  private contract: ethers.Contract;

  constructor(networkId: NetworkId, address: string, contract: ethers.Contract) {
    this.networkId = networkId;
    this.address = address;
    this.contract = contract;
  }

  public getAddress() {
    return this.address;
  }

  public async getState(): Promise<any> {
    const bytecodeSha = ethers.sha256(await this.contract.getDeployedCode() as string);

    return {
      bytecodeSha
    }
  }
}

export function loadFromConfig(contractsConfig: any, networksConfig: any): Contract[] {
  const contracts = []
  for (const contractConfig of contractsConfig) {
    contracts.push(fromConfig(contractConfig, networksConfig));
  }
  return contracts;
}

export function fromConfig(contractConfig: any, networksConfig: any): Contract {
  switch (contractConfig.type) {
    case ContractType.EvmPythUpgradable: {
      const ethersContract = new ethers.Contract(
        contractConfig.address,
        PythAbi,
        getEvmProvider(contractConfig.networkId, networksConfig)
      );

      return new EvmTargetChainContract(
        contractConfig.networkId,
        contractConfig.address,
        ethersContract,
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
        ethersContract,
      );
    }
    default:
      throw new Error(`unknown contract type: ${contractConfig.type}`);
  }
}

export function getEvmProvider(networkId: NetworkId, networksConfig: any): ethers.Provider {
  const networkConfig = networksConfig["evm"][networkId]!
  return ethers.getDefaultProvider(networkConfig.url);
}
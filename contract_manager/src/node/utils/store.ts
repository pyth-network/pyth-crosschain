import {
  AptosChain,
  Chain,
  CosmWasmChain,
  StarknetChain,
  EvmChain,
  FuelChain,
  GlobalChain,
  SuiChain,
  TonChain,
  NearChain,
  IotaChain,
} from "../../core/chains";
import {
  AptosPriceFeedContract,
  AptosWormholeContract,
  CosmWasmPriceFeedContract,
  CosmWasmWormholeContract,
  EvmEntropyContract,
  EvmPriceFeedContract,
  EvmWormholeContract,
  SuiPriceFeedContract,
  SuiWormholeContract,
  FuelWormholeContract,
  WormholeContract,
  FuelPriceFeedContract,
  EvmExpressRelayContract,
  TonPriceFeedContract,
  TonWormholeContract,
  IotaWormholeContract,
  IotaPriceFeedContract,
  EvmPulseContract,
} from "../../core/contracts";
import { Token } from "../../core/token";
import { PriceFeedContract, Storable } from "../../core/base";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { Vault } from "./governance";
import {
  StarknetPriceFeedContract,
  StarknetWormholeContract,
} from "../../core/contracts/starknet";
import {
  NearPriceFeedContract,
  NearWormholeContract,
} from "../../core/contracts/near";

export class Store {
  public chains: Record<string, Chain> = { global: new GlobalChain() };
  public contracts: Record<string, PriceFeedContract> = {};
  public entropy_contracts: Record<string, EvmEntropyContract> = {};
  public pulse_contracts: Record<string, EvmPulseContract> = {};
  public wormhole_contracts: Record<string, WormholeContract> = {};
  public express_relay_contracts: Record<string, EvmExpressRelayContract> = {};
  public tokens: Record<string, Token> = {};
  public vaults: Record<string, Vault> = {};

  constructor(public path: string) {
    this.loadAllChains();
    this.loadAllContracts();
    this.loadAllTokens();
    this.loadAllVaults();
  }

  static serialize(obj: Storable) {
    return JSON.stringify([obj.toJson()], null, 2);
  }

  getJsonFiles(path: string) {
    const walk = function (dir: string) {
      let results: string[] = [];
      const list = readdirSync(dir);
      list.forEach(function (file) {
        file = dir + "/" + file;
        const stat = statSync(file);
        if (stat && stat.isDirectory()) {
          // Recurse into a subdirectory
          results = results.concat(walk(file));
        } else {
          // Is a file
          results.push(file);
        }
      });
      return results;
    };
    return walk(path).filter((file) => file.endsWith(".json"));
  }

  loadAllChains() {
    const allChainClasses = {
      [CosmWasmChain.type]: CosmWasmChain,
      [SuiChain.type]: SuiChain,
      [EvmChain.type]: EvmChain,
      [AptosChain.type]: AptosChain,
      [FuelChain.type]: FuelChain,
      [StarknetChain.type]: StarknetChain,
      [TonChain.type]: TonChain,
      [NearChain.type]: NearChain,
      [SuiChain.type]: SuiChain,
      [IotaChain.type]: IotaChain,
    };

    this.getJsonFiles(`${this.path}/chains/`).forEach((jsonFile) => {
      const parsedArray = JSON.parse(readFileSync(jsonFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (allChainClasses[parsed.type] === undefined) {
          throw new Error(
            `No chain class found for chain type: ${parsed.type}`,
          );
        }
        const chain = allChainClasses[parsed.type].fromJson(parsed);
        if (this.chains[chain.getId()])
          throw new Error(`Multiple chains with id ${chain.getId()} found`);
        this.chains[chain.getId()] = chain;
      }
    });
  }

  saveAllContracts() {
    const contractsByType: Record<string, Storable[]> = {};
    const contracts: Storable[] = Object.values(this.contracts);
    contracts.push(...Object.values(this.entropy_contracts));
    contracts.push(...Object.values(this.wormhole_contracts));
    for (const contract of contracts) {
      if (!contractsByType[contract.getType()]) {
        contractsByType[contract.getType()] = [];
      }
      contractsByType[contract.getType()].push(contract);
    }
    for (const [type, contracts] of Object.entries(contractsByType)) {
      writeFileSync(
        `${this.path}/contracts/${type}s.json`,
        JSON.stringify(
          contracts.map((c) => c.toJson()),
          null,
          2,
        ),
      );
    }
  }

  saveAllChains() {
    const chainsByType: Record<string, Chain[]> = {};
    for (const chain of Object.values(this.chains)) {
      if (!chainsByType[chain.getType()]) {
        chainsByType[chain.getType()] = [];
      }
      chainsByType[chain.getType()].push(chain);
    }
    for (const [type, chains] of Object.entries(chainsByType)) {
      writeFileSync(
        `${this.path}/chains/${type}s.json`,
        JSON.stringify(
          chains.map((c) => c.toJson()),
          null,
          2,
        ),
      );
    }
  }

  loadAllContracts() {
    const allContractClasses = {
      [CosmWasmPriceFeedContract.type]: CosmWasmPriceFeedContract,
      [CosmWasmWormholeContract.type]: CosmWasmWormholeContract,
      [SuiPriceFeedContract.type]: SuiPriceFeedContract,
      [SuiWormholeContract.type]: SuiWormholeContract,
      [EvmPriceFeedContract.type]: EvmPriceFeedContract,
      [AptosPriceFeedContract.type]: AptosPriceFeedContract,
      [AptosWormholeContract.type]: AptosWormholeContract,
      [EvmEntropyContract.type]: EvmEntropyContract,
      [EvmExpressRelayContract.type]: EvmExpressRelayContract,
      [EvmWormholeContract.type]: EvmWormholeContract,
      [FuelPriceFeedContract.type]: FuelPriceFeedContract,
      [FuelWormholeContract.type]: FuelWormholeContract,
      [StarknetPriceFeedContract.type]: StarknetPriceFeedContract,
      [StarknetWormholeContract.type]: StarknetWormholeContract,
      [TonPriceFeedContract.type]: TonPriceFeedContract,
      [TonWormholeContract.type]: TonWormholeContract,
      [NearPriceFeedContract.type]: NearPriceFeedContract,
      [NearWormholeContract.type]: NearWormholeContract,
      [IotaPriceFeedContract.type]: IotaPriceFeedContract,
      [IotaWormholeContract.type]: IotaWormholeContract,
    };
    this.getJsonFiles(`${this.path}/contracts/`).forEach((jsonFile) => {
      const parsedArray = JSON.parse(readFileSync(jsonFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (allContractClasses[parsed.type] === undefined) return;
        if (!this.chains[parsed.chain])
          throw new Error(`Chain ${parsed.chain} not found`);
        const chain = this.chains[parsed.chain];
        const chainContract = allContractClasses[parsed.type].fromJson(
          chain,
          parsed,
        );
        if (
          this.contracts[chainContract.getId()] ||
          this.entropy_contracts[chainContract.getId()] ||
          this.wormhole_contracts[chainContract.getId()]
        )
          throw new Error(
            `Multiple contracts with id ${chainContract.getId()} found`,
          );
        if (chainContract instanceof EvmEntropyContract) {
          this.entropy_contracts[chainContract.getId()] = chainContract;
        } else if (chainContract instanceof EvmExpressRelayContract) {
          this.express_relay_contracts[chainContract.getId()] = chainContract;
        } else if (chainContract instanceof WormholeContract) {
          this.wormhole_contracts[chainContract.getId()] = chainContract;
        } else {
          this.contracts[chainContract.getId()] = chainContract;
        }
      }
    });
  }

  loadAllTokens() {
    this.getJsonFiles(`${this.path}/tokens/`).forEach((jsonFile) => {
      const parsedArray = JSON.parse(readFileSync(jsonFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (parsed.type !== Token.type) return;

        const token = Token.fromJson(parsed);
        if (this.tokens[token.getId()])
          throw new Error(`Multiple tokens with id ${token.getId()} found`);
        this.tokens[token.getId()] = token;
      }
    });
  }

  loadAllVaults() {
    this.getJsonFiles(`${this.path}/vaults/`).forEach((jsonFile) => {
      const parsedArray = JSON.parse(readFileSync(jsonFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (parsed.type !== Vault.type) return;

        const vault = Vault.fromJson(parsed);
        if (this.vaults[vault.getId()])
          throw new Error(`Multiple vaults with id ${vault.getId()} found`);
        this.vaults[vault.getId()] = vault;
      }
    });
  }

  /**
   * Returns the chain with the given ID, or throws an error if it doesn't exist or is not of the specified type.
   * @param chainId The unique identifier of the chain to retrieve
   * @param ChainClass Optional class to validate the chain type.
   * @returns The chain instance of type T
   * @throws Error if chain doesn't exist or is not of the specified type
   * @template T Type of chain to return, extends base Chain class
   */
  getChainOrThrow<T extends Chain>(
    chainId: string,
    ChainClass?: { new (...args: any[]): T; type: string }, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): T {
    const chain = this.chains[chainId];
    if (!chain) {
      throw new Error(`Chain with ID '${chainId}' does not exist.`);
    }
    if (ChainClass && !(chain instanceof ChainClass)) {
      throw new Error(
        `Chain with ID '${chainId}' is not of type ${ChainClass.type}.`,
      );
    }
    return chain as T;
  }
}

/**
 * DefaultStore loads all the contracts and chains from the store directory and provides a single point of access to them.
 */
export const DefaultStore = new Store(`${__dirname}/../../../store`);

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
} from "./chains";
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
} from "./contracts";
import { Token } from "./token";
import { PriceFeedContract, Storable } from "./base";
import { parse, stringify } from "yaml";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { Vault } from "./governance";
import {
  StarknetPriceFeedContract,
  StarknetWormholeContract,
} from "./contracts/starknet";

export class Store {
  public chains: Record<string, Chain> = { global: new GlobalChain() };
  public contracts: Record<string, PriceFeedContract> = {};
  public entropy_contracts: Record<string, EvmEntropyContract> = {};
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
    return stringify([obj.toJson()]);
  }

  getYamlFiles(path: string) {
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
    return walk(path).filter((file) => file.endsWith(".yaml"));
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
    };

    this.getYamlFiles(`${this.path}/chains/`).forEach((yamlFile) => {
      const parsedArray = parse(readFileSync(yamlFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (allChainClasses[parsed.type] === undefined) {
          throw new Error(
            `No chain class found for chain type: ${parsed.type}`
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
        `${this.path}/contracts/${type}s.yaml`,
        stringify(contracts.map((c) => c.toJson()))
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
        `${this.path}/chains/${type}s.yaml`,
        stringify(chains.map((c) => c.toJson()))
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
    };
    this.getYamlFiles(`${this.path}/contracts/`).forEach((yamlFile) => {
      const parsedArray = parse(readFileSync(yamlFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (allContractClasses[parsed.type] === undefined) return;
        if (!this.chains[parsed.chain])
          throw new Error(`Chain ${parsed.chain} not found`);
        const chain = this.chains[parsed.chain];
        const chainContract = allContractClasses[parsed.type].fromJson(
          chain,
          parsed
        );
        if (
          this.contracts[chainContract.getId()] ||
          this.entropy_contracts[chainContract.getId()] ||
          this.wormhole_contracts[chainContract.getId()]
        )
          throw new Error(
            `Multiple contracts with id ${chainContract.getId()} found`
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
    this.getYamlFiles(`${this.path}/tokens/`).forEach((yamlFile) => {
      const parsedArray = parse(readFileSync(yamlFile, "utf-8"));
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
    this.getYamlFiles(`${this.path}/vaults/`).forEach((yamlFile) => {
      const parsedArray = parse(readFileSync(yamlFile, "utf-8"));
      for (const parsed of parsedArray) {
        if (parsed.type !== Vault.type) return;

        const vault = Vault.fromJson(parsed);
        if (this.vaults[vault.getId()])
          throw new Error(`Multiple vaults with id ${vault.getId()} found`);
        this.vaults[vault.getId()] = vault;
      }
    });
  }
}

/**
 * DefaultStore loads all the contracts and chains from the store directory and provides a single point of access to them.
 */
export const DefaultStore = new Store(`${__dirname}/../store`);

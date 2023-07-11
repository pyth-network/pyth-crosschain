import { Chain, CosmWasmChain, SuiChain, Chains } from "./chains";
import { CosmWasmContract } from "./cosmwasm";
import { SuiContract } from "./sui";
import { Contract } from "./base";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from "fs";
import { Contracts } from "./entities";

class Store {
  static Chains: Record<string, Chain> = {};
  static Contracts: Record<string, CosmWasmContract | SuiContract> = {};

  constructor(public path: string) {
    this.loadAllChains();
    this.loadAllContracts();
  }

  save(obj: any) {
    let dir, file, content;
    if (obj instanceof Contract) {
      let contract = obj;
      dir = `${this.path}/contracts/${contract.getType()}`;
      file = contract.getId();
      content = contract.toJSON();
    } else if (obj instanceof Chain) {
      let chain = obj;
      dir = `${this.path}/chains/${chain.getType()}`;
      file = chain.getId();
      content = chain.toJSON();
    } else {
      throw new Error("Invalid type");
    }
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      `${dir}/${file}.json`,
      JSON.stringify(content, undefined, 2) + "\n"
    );
  }

  getJSONFiles(path: string) {
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
    let allChainClasses = {
      [CosmWasmChain.type]: CosmWasmChain,
      [SuiChain.type]: SuiChain,
    };

    this.getJSONFiles(`${this.path}/chains/`).forEach((jsonFile) => {
      let parsed = JSON.parse(readFileSync(jsonFile, "utf-8"));
      if (allChainClasses[parsed.type] === undefined) return;
      let chain = allChainClasses[parsed.type].fromJSON(parsed);
      if (Chains[chain.getId()])
        throw new Error(`Multiple chains with id ${chain.getId()} found`);
      Chains[chain.getId()] = chain;
    });
  }

  loadAllContracts() {
    let allContractClasses = {
      [CosmWasmContract.type]: CosmWasmContract,
      [SuiContract.type]: SuiContract,
    };
    this.getJSONFiles(`${this.path}/contracts/`).forEach((jsonFile) => {
      let parsed = JSON.parse(readFileSync(jsonFile, "utf-8"));
      if (allContractClasses[parsed.type] === undefined) return;
      let chainContract = allContractClasses[parsed.type].fromJSON(parsed);
      if (Contracts[chainContract.getId()])
        throw new Error(
          `Multiple contracts with id ${chainContract.getId()} found`
        );
      Contracts[chainContract.getId()] = chainContract;
    });
  }
}

export const DefaultStore = new Store(`${__dirname}/../store`);

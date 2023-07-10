import { Chains, CosmWasmChain } from "./chains";
import { readFileSync, writeFileSync } from "fs";
import { getPythConfig } from "@pythnetwork/cosmwasm-deploy-tools/lib/configs";
import { CHAINS, SetFeeInstruction } from "@pythnetwork/xc-governance-sdk";
import { DeploymentType } from "@pythnetwork/cosmwasm-deploy-tools/lib/helper";
import {
  CosmwasmExecutor,
  PythWrapperExecutor,
  PythWrapperQuerier,
} from "@pythnetwork/cosmwasm-deploy-tools";
import {
  ContractInfoResponse,
  CosmwasmQuerier,
} from "@pythnetwork/cosmwasm-deploy-tools/lib/chains-manager/chain-querier";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

namespace CosmWasmContract {
  export interface WormholeSource {
    emitter: string;
    chain_id: number;
  }

  export interface DeploymentConfig {
    data_sources: WormholeSource[];
    governance_source: WormholeSource;
    wormhole_contract: string;
    governance_source_index: number;
    governance_sequence_number: number;
    chain_id: number;
    valid_time_period_secs: number;
    fee: { amount: string; denom: string };
  }
}

export class CosmWasmContract {
  static type = "CosmWasmContract";

  constructor(public chain: CosmWasmChain, public address: string) {}

  static from(path: string): CosmWasmContract {
    let parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (parsed.type !== CosmWasmContract.type) throw new Error("Invalid type");
    if (!Chains[parsed.chain])
      throw new Error(`Chain ${parsed.chain} not found`);
    return new CosmWasmContract(
      Chains[parsed.chain] as CosmWasmChain,
      parsed.address
    );
  }

  //TODO : make deploymentType enum stable  | edge
  static getDeploymentConfig(
    chain: CosmWasmChain,
    deploymentType: string,
    wormholeContract: string
  ): CosmWasmContract.DeploymentConfig {
    return getPythConfig({
      feeDenom: chain.feeDenom,
      wormholeChainId: CHAINS[chain.getId() as keyof typeof CHAINS],
      wormholeContract,
      deploymentType: deploymentType as DeploymentType,
    });
  }

  static async deploy(
    chain: CosmWasmChain,
    codeId: number,
    config: CosmWasmContract.DeploymentConfig,
    mnemonic: string
  ): Promise<any> {
    let executor = new CosmwasmExecutor(
      chain.executorEndpoint,
      mnemonic,
      chain.prefix,
      chain.gasPrice + chain.feeDenom
    );
    console.log(executor);
    let result = await executor.instantiateContract({
      codeId: codeId,
      instMsg: config,
      label: "pyth",
    });
    await executor.updateContractAdmin({
      newAdminAddr: result.contractAddr,
      contractAddr: result.contractAddr,
    });
    return new CosmWasmContract(chain, result.contractAddr);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  to(path: string): void {
    writeFileSync(
      `${path}/${this.getId()}.${CosmWasmContract.type}.json`,
      JSON.stringify(
        {
          chain: this.chain.id,
          address: this.address,
          type: CosmWasmContract.type,
        },
        undefined,
        2
      )
    );
  }

  async getQuerier(): Promise<PythWrapperQuerier> {
    const chainQuerier = await CosmwasmQuerier.connect(
      this.chain.querierEndpoint
    );
    const pythQuerier = new PythWrapperQuerier(chainQuerier);
    return pythQuerier;
  }

  async getCodeId(): Promise<number> {
    let result = await this.getWasmContractInfo();
    return result.codeId;
  }

  async getWasmContractInfo(): Promise<ContractInfoResponse> {
    const chainQuerier = await CosmwasmQuerier.connect(
      this.chain.querierEndpoint
    );
    return chainQuerier.getContractInfo({ contractAddr: this.address });
  }

  async getConfig() {
    const chainQuerier = await CosmwasmQuerier.connect(
      this.chain.querierEndpoint
    );
    let allStates = (await chainQuerier.getAllContractState({
      contractAddr: this.address,
    })) as any;
    let config = {
      config_v1: JSON.parse(allStates["\x00\tconfig_v1"]),
      contract_version: JSON.parse(allStates["\x00\x10contract_version"]),
    };
    return config;
  }

  // TODO: function for uploading the code and getting the code id
  // TODO: function for upgrading the contract
  // TODO: Cleanup and more strict linter to convert let to const

  async getPriceFeed(feedId: string): Promise<any> {
    let querier = await this.getQuerier();
    return querier.getPriceFeed(this.address, feedId);
  }

  equalDataSources(
    dataSources1: CosmWasmContract.WormholeSource[],
    dataSources2: CosmWasmContract.WormholeSource[]
  ): boolean {
    if (dataSources1.length !== dataSources2.length) return false;
    for (let i = 0; i < dataSources1.length; i++) {
      let found = false;
      for (let j = 0; j < dataSources2.length; j++) {
        if (
          dataSources1[i].emitter === dataSources2[j].emitter &&
          dataSources1[i].chain_id === dataSources2[j].chain_id
        ) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  async getDeploymentType(): Promise<string> {
    let config = await this.getConfig();
    let wormholeContract = config.config_v1.wormhole_contract;
    let stableConfig = getPythConfig({
      feeDenom: this.chain.feeDenom,
      wormholeChainId: CHAINS[this.chain.getId() as keyof typeof CHAINS],
      wormholeContract,
      deploymentType: "stable",
    });
    let edgeConfig = getPythConfig({
      feeDenom: this.chain.feeDenom,
      wormholeChainId: CHAINS[this.chain.getId() as keyof typeof CHAINS],
      wormholeContract,
      deploymentType: "edge",
    });
    console.log(
      config.config_v1.data_sources,
      stableConfig.data_sources,
      edgeConfig.data_sources
    );
    if (
      this.equalDataSources(
        config.config_v1.data_sources,
        stableConfig.data_sources
      )
    )
      return "stable";
    else if (
      this.equalDataSources(
        config.config_v1.data_sources,
        edgeConfig.data_sources
      )
    )
      return "edge";
    else return "unknown";
  }

  async executeUpdatePriceFeed(mnemonic: string) {
    const deploymentType = await this.getDeploymentType();
    const priceServiceConnection = new PriceServiceConnection(
      deploymentType === "stable"
        ? "https://xc-mainnet.pyth.network"
        : "https://xc-testnet.pyth.network"
    );

    const priceFeedId =
      deploymentType === "stable"
        ? "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
        : "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    const vaas = await priceServiceConnection.getLatestVaas([priceFeedId]);
    console.log(vaas);
    const fund = await this.getUpdateFee(vaas);
    console.log(fund);
    let executor = new CosmwasmExecutor(
      this.chain.executorEndpoint,
      mnemonic,
      this.chain.prefix,
      this.chain.gasPrice + this.chain.feeDenom
    );
    let pythExecutor = new PythWrapperExecutor(executor);
    return pythExecutor.executeUpdatePriceFeeds({
      contractAddr: this.address,
      vaas,
      fund,
    });
  }

  async executeGovernanceInstruction(mnemonic: string, vaa: string) {
    let executor = new CosmwasmExecutor(
      this.chain.executorEndpoint,
      mnemonic,
      this.chain.prefix,
      this.chain.gasPrice + this.chain.feeDenom
    );
    let pythExecutor = new PythWrapperExecutor(executor);
    return pythExecutor.executeGovernanceInstruction({
      contractAddr: this.address,
      vaa,
    });
  }

  async getUpdateFee(msgs: string[]): Promise<any> {
    let querier = await this.getQuerier();
    return querier.getUpdateFee(this.address, msgs);
  }

  getSetUpdateFeePayload(fee: number): Buffer {
    return new SetFeeInstruction(
      CHAINS[this.chain.getId() as keyof typeof CHAINS],
      BigInt(fee),
      BigInt(0)
    ).serialize();
  }

  async getValidTimePeriod(): Promise<any> {
    let client = await CosmWasmClient.connect(this.chain.querierEndpoint);
    let result = await client.queryContractSmart(
      this.address,
      "get_valid_time_period"
    );
    return result;
  }
}

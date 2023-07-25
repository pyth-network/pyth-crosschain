import { Chain, CosmWasmChain } from "./chains";
import { readFileSync } from "fs";
import { getPythConfig } from "@pythnetwork/cosmwasm-deploy-tools/lib/configs";
import {
  CHAINS,
  DataSource,
  HexString32Bytes,
} from "@pythnetwork/xc-governance-sdk";
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
import { Contract } from "./base";

/**
 * Variables here need to be snake case to match the on-chain contract configs
 */
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

export class CosmWasmContract extends Contract {
  async getDataSources(): Promise<DataSource[]> {
    const config = await this.getConfig();
    return config.config_v1.data_sources.map(({ emitter, chain_id }: any) => {
      return new DataSource(
        Number(chain_id),
        new HexString32Bytes(Buffer.from(emitter, "base64").toString("hex"))
      );
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const config = await this.getConfig();
    const { emitter: emitterAddress, chain_id: chainId } =
      config.config_v1.governance_source;
    return new DataSource(
      Number(chainId),
      new HexString32Bytes(
        Buffer.from(emitterAddress, "base64").toString("hex")
      )
    );
  }

  static type = "CosmWasmContract";

  constructor(public chain: CosmWasmChain, public address: string) {
    super();
  }

  static fromJson(chain: Chain, parsed: any): CosmWasmContract {
    if (parsed.type !== CosmWasmContract.type) throw new Error("Invalid type");
    if (!(chain instanceof CosmWasmChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new CosmWasmContract(chain, parsed.address);
  }

  getType(): string {
    return CosmWasmContract.type;
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

  /**
   * Stores the wasm code on the specified chain using the provided mnemonic as the signer
   * You can find the wasm artifacts from the repo releases
   * @param chain chain to store the code on
   * @param mnemonic mnemonic to use for signing the transaction
   * @param wasmPath path in your local filesystem to the wasm artifact
   */
  static async storeCode(
    chain: CosmWasmChain,
    mnemonic: string,
    wasmPath: string
  ) {
    const contractBytes = readFileSync(wasmPath);
    let executor = this.getExecutor(chain, mnemonic);
    return executor.storeCode({ contractBytes });
  }

  /**
   * Deploys a new contract to the specified chain using the uploaded wasm code codeId
   * @param chain chain to deploy to
   * @param codeId codeId of the uploaded wasm code. You can get this from the storeCode result
   * @param config deployment config for initializing the contract (data sources, governance source, etc)
   * @param mnemonic mnemonic to use for signing the transaction
   */
  static async initialize(
    chain: CosmWasmChain,
    codeId: number,
    config: CosmWasmContract.DeploymentConfig,
    mnemonic: string
  ): Promise<CosmWasmContract> {
    let executor = this.getExecutor(chain, mnemonic);
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

  /**
   * Uploads the wasm code and initializes a new contract to the specified chain.
   * Use this method if you are deploying to a new chain, or you want a fresh contract in
   * a testnet environment. Uses the default deployment configurations for governance, data sources,
   * valid time period, etc. You can manually run the storeCode and initialize methods if you want
   * more control over the deployment process.
   * @param chain
   * @param wormholeContract
   * @param mnemonic
   * @param wasmPath
   */
  static async deploy(
    chain: CosmWasmChain,
    wormholeContract: string,
    mnemonic: string,
    wasmPath: string
  ): Promise<CosmWasmContract> {
    let config = this.getDeploymentConfig(chain, "edge", wormholeContract);
    const { codeId } = await this.storeCode(chain, mnemonic, wasmPath);
    return this.initialize(chain, codeId, config, mnemonic);
  }

  private static getExecutor(chain: CosmWasmChain, mnemonic: string) {
    // TODO: logic for injective
    return new CosmwasmExecutor(
      chain.executorEndpoint,
      mnemonic,
      chain.prefix,
      chain.gasPrice + chain.feeDenom
    );
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  toJson() {
    return {
      chain: this.chain.id,
      address: this.address,
      type: CosmWasmContract.type,
    };
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

  async executeUpdatePriceFeed(feedId: string, mnemonic: string) {
    const deploymentType = await this.getDeploymentType();
    const priceServiceConnection = new PriceServiceConnection(
      deploymentType === "stable"
        ? "https://xc-mainnet.pyth.network"
        : "https://xc-testnet.pyth.network"
    );

    const vaas = await priceServiceConnection.getLatestVaas([feedId]);
    const fund = await this.getUpdateFee(vaas);
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

  async executeGovernanceInstruction(mnemonic: string, vaa: Buffer) {
    let executor = new CosmwasmExecutor(
      this.chain.executorEndpoint,
      mnemonic,
      this.chain.prefix,
      this.chain.gasPrice + this.chain.feeDenom
    );
    let pythExecutor = new PythWrapperExecutor(executor);
    return pythExecutor.executeGovernanceInstruction({
      contractAddr: this.address,
      vaa: vaa.toString("base64"),
    });
  }

  async getUpdateFee(msgs: string[]): Promise<any> {
    let querier = await this.getQuerier();
    return querier.getUpdateFee(this.address, msgs);
  }

  async getBaseUpdateFee(): Promise<any> {
    const config = await this.getConfig();
    return config.config_v1.fee;
  }

  getChain(): CosmWasmChain {
    return this.chain;
  }

  async getValidTimePeriod() {
    let client = await CosmWasmClient.connect(this.chain.querierEndpoint);
    let result = await client.queryContractSmart(
      this.address,
      "get_valid_time_period"
    );
    return Number(result.secs + result.nanos * 1e-9);
  }
}

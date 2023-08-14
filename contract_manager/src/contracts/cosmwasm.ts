import { Chain, CosmWasmChain } from "../chains";
import { readFileSync } from "fs";
import {
  ContractInfoResponse,
  CosmwasmQuerier,
  DeploymentType,
  getPythConfig,
  Price,
  PythWrapperExecutor,
  PythWrapperQuerier,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { CHAINS, DataSource } from "xc_admin_common";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Contract } from "../base";
import { WormholeContract } from "./wormhole";

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

export class WormholeCosmWasmContract extends WormholeContract {
  constructor(public chain: CosmWasmChain, public address: string) {
    super();
  }

  async getConfig() {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    return (await chainQuerier.getAllContractState({
      contractAddr: this.address,
    })) as any;
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const config = await this.getConfig();
    return JSON.parse(config["\x00\x06config"])["guardian_set_index"];
  }

  async getGuardianSet(): Promise<string[]> {
    const config = await this.getConfig();
    const guardianSetIndex = JSON.parse(config["\x00\x06config"])[
      "guardian_set_index"
    ];
    let key = "\x00\fguardian_set";
    //append guardianSetIndex as 4 bytes to key string
    key += Buffer.from(guardianSetIndex.toString(16).padStart(8, "0"), "hex");

    const guardianSet = JSON.parse(config[key])["addresses"];
    return guardianSet.map((entry: { bytes: string }) =>
      Buffer.from(entry.bytes, "base64").toString("hex")
    );
  }

  async upgradeGuardianSets(
    senderPrivateKey: string,
    vaa: Buffer
  ): Promise<any> {
    const executor = await this.chain.getExecutor(senderPrivateKey);
    return executor.executeContract({
      contractAddr: this.address,
      msg: {
        submit_v_a_a: { vaa: vaa.toString("base64") },
      },
    });
  }
}

export class CosmWasmContract extends Contract {
  async getDataSources(): Promise<DataSource[]> {
    const config = await this.getConfig();
    return config.config_v1.data_sources.map(({ emitter, chain_id }: any) => {
      return {
        emitterChain: Number(chain_id),
        emitterAddress: Buffer.from(emitter, "base64").toString("hex"),
      };
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const config = await this.getConfig();
    const { emitter: emitterAddress, chain_id: chainId } =
      config.config_v1.governance_source;
    return {
      emitterChain: Number(chainId),
      emitterAddress: Buffer.from(emitterAddress, "base64").toString("hex"),
    };
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
   * Stores the wasm code on the specified chain using the provided private key as the signer
   * You can find the wasm artifacts from the repo releases
   * @param chain chain to store the code on
   * @param privateKey private key to use for signing the transaction in hex format without 0x prefix
   * @param wasmPath path in your local filesystem to the wasm artifact
   */
  static async storeCode(
    chain: CosmWasmChain,
    privateKey: string,
    wasmPath: string
  ) {
    const contractBytes = readFileSync(wasmPath);
    let executor = await chain.getExecutor(privateKey);
    return executor.storeCode({ contractBytes });
  }

  /**
   * Deploys a new contract to the specified chain using the uploaded wasm code codeId
   * @param chain chain to deploy to
   * @param codeId codeId of the uploaded wasm code. You can get this from the storeCode result
   * @param config deployment config for initializing the contract (data sources, governance source, etc)
   * @param privateKey private key to use for signing the transaction in hex format without 0x prefix
   */
  static async initialize(
    chain: CosmWasmChain,
    codeId: number,
    config: CosmWasmContract.DeploymentConfig,
    privateKey: string
  ): Promise<CosmWasmContract> {
    let executor = await chain.getExecutor(privateKey);
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
   * @param privateKey private key to use for signing the transaction in hex format without 0x prefix
   * @param wasmPath
   */
  static async deploy(
    chain: CosmWasmChain,
    wormholeContract: string,
    privateKey: string,
    wasmPath: string
  ): Promise<CosmWasmContract> {
    let config = this.getDeploymentConfig(chain, "edge", wormholeContract);
    const { codeId } = await this.storeCode(chain, privateKey, wasmPath);
    return this.initialize(chain, codeId, config, privateKey);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: CosmWasmContract.type,
    };
  }

  async getQuerier(): Promise<PythWrapperQuerier> {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    const pythQuerier = new PythWrapperQuerier(chainQuerier);
    return pythQuerier;
  }

  async getCodeId(): Promise<number> {
    let result = await this.getWasmContractInfo();
    return result.codeId;
  }

  async getWasmContractInfo(): Promise<ContractInfoResponse> {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    return chainQuerier.getContractInfo({ contractAddr: this.address });
  }

  async getConfig() {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    let allStates = (await chainQuerier.getAllContractState({
      contractAddr: this.address,
    })) as any;
    let config = {
      config_v1: JSON.parse(allStates["\x00\tconfig_v1"]),
      contract_version: JSON.parse(allStates["\x00\x10contract_version"]),
    };
    return config;
  }

  async getLastExecutedGovernanceSequence() {
    const config = await this.getConfig();
    return Number(config.config_v1.governance_sequence_number);
  }

  // TODO: function for upgrading the contract
  // TODO: Cleanup and more strict linter to convert let to const

  private parsePrice(priceInfo: Price) {
    return {
      conf: priceInfo.conf.toString(),
      publishTime: priceInfo.publish_time.toString(),
      expo: priceInfo.expo.toString(),
      price: priceInfo.price.toString(),
    };
  }

  async getPriceFeed(feedId: string) {
    let querier = await this.getQuerier();
    try {
      const response = await querier.getPriceFeed(this.address, feedId);
      return {
        price: this.parsePrice(response.price),
        emaPrice: this.parsePrice(response.ema_price),
      };
    } catch (e) {
      return undefined;
    }
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

  async executeUpdatePriceFeed(senderPrivateKey: string, vaas: Buffer[]) {
    const base64Vaas = vaas.map((v) => v.toString("base64"));
    const fund = await this.getUpdateFee(base64Vaas);
    let executor = await this.chain.getExecutor(senderPrivateKey);
    let pythExecutor = new PythWrapperExecutor(executor);
    const result = await pythExecutor.executeUpdatePriceFeeds({
      contractAddr: this.address,
      vaas: base64Vaas,
      fund,
    });
    return { id: result.txHash, info: result };
  }

  async executeGovernanceInstruction(privateKey: string, vaa: Buffer) {
    let executor = await this.chain.getExecutor(privateKey);
    let pythExecutor = new PythWrapperExecutor(executor);
    const result = await pythExecutor.executeGovernanceInstruction({
      contractAddr: this.address,
      vaa: vaa.toString("base64"),
    });
    return { id: result.txHash, info: result };
  }

  async getWormholeContract(): Promise<WormholeCosmWasmContract> {
    let config = await this.getConfig();
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    const wormholeAddress = config.config_v1.wormhole_contract;
    return new WormholeCosmWasmContract(this.chain, wormholeAddress);
  }

  async getUpdateFee(msgs: string[]): Promise<any> {
    let querier = await this.getQuerier();
    return querier.getUpdateFee(this.address, msgs);
  }

  async getBaseUpdateFee(): Promise<any> {
    const config = await this.getConfig();
    return config.config_v1.fee;
  }

  async getVersion(): Promise<any> {
    const config = await this.getConfig();
    return config.contract_version;
  }

  getChain(): CosmWasmChain {
    return this.chain;
  }

  async getValidTimePeriod() {
    let client = await CosmWasmClient.connect(this.chain.endpoint);
    let result = await client.queryContractSmart(
      this.address,
      "get_valid_time_period"
    );
    return Number(result.secs + result.nanos * 1e-9);
  }
}

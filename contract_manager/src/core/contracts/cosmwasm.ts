import { Chain, CosmWasmChain } from "../chains";
import { readFileSync } from "fs";
import {
  ContractInfoResponse,
  CosmwasmQuerier,
  Price,
  PythWrapperExecutor,
  PythWrapperQuerier,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { Coin } from "@cosmjs/stargate";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  PriceFeedContract,
  getDefaultDeploymentConfig,
  PrivateKey,
  TxResult,
} from "../base";
import { WormholeContract } from "./wormhole";
import { TokenQty } from "../token";

/**
 * Variables here need to be snake case to match the on-chain contract configs
 */
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

export class CosmWasmWormholeContract extends WormholeContract {
  static type = "CosmWasmWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return CosmWasmWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: CosmWasmWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): CosmWasmWormholeContract {
    if (parsed.type !== CosmWasmWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof CosmWasmChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new CosmWasmWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: CosmWasmChain,
    public address: string,
  ) {
    super();
  }

  async getConfig() {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    return (await chainQuerier.getAllContractState({
      contractAddr: this.address,
    })) as Record<string, string>;
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const config = await this.getConfig();
    return JSON.parse(config["\x00\x06config"])["guardian_set_index"];
  }

  async getChainId(): Promise<number> {
    const config = await this.getConfig();
    return JSON.parse(config["\x00\x06config"])["chain_id"];
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
      Buffer.from(entry.bytes, "base64").toString("hex"),
    );
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const executor = await this.chain.getExecutor(senderPrivateKey);
    const result = await executor.executeContract({
      contractAddr: this.address,
      msg: {
        submit_v_a_a: { vaa: vaa.toString("base64") },
      },
    });
    return { id: result.txHash, info: result };
  }
}

export class CosmWasmPriceFeedContract extends PriceFeedContract {
  static type = "CosmWasmPriceFeedContract";
  async getDataSources(): Promise<DataSource[]> {
    const config = await this.getConfig();
    return config.config_v1.data_sources.map(
      ({ emitter, chain_id }: WormholeSource) => {
        return {
          emitterChain: Number(chain_id),
          emitterAddress: Buffer.from(emitter, "base64").toString("hex"),
        };
      },
    );
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

  constructor(
    public chain: CosmWasmChain,
    public address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): CosmWasmPriceFeedContract {
    if (parsed.type !== CosmWasmPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof CosmWasmChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new CosmWasmPriceFeedContract(chain, parsed.address);
  }

  getType(): string {
    return CosmWasmPriceFeedContract.type;
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
    privateKey: PrivateKey,
    wasmPath: string,
  ) {
    const contractBytes = readFileSync(wasmPath);
    const executor = await chain.getExecutor(privateKey);
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
    config: DeploymentConfig,
    privateKey: PrivateKey,
  ): Promise<CosmWasmPriceFeedContract> {
    const executor = await chain.getExecutor(privateKey);
    const result = await executor.instantiateContract({
      codeId: codeId,
      instMsg: config,
      label: "pyth",
    });
    await executor.updateContractAdmin({
      newAdminAddr: result.contractAddr,
      contractAddr: result.contractAddr,
    });
    return new CosmWasmPriceFeedContract(chain, result.contractAddr);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: CosmWasmPriceFeedContract.type,
    };
  }

  async getQuerier(): Promise<PythWrapperQuerier> {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    const pythQuerier = new PythWrapperQuerier(chainQuerier);
    return pythQuerier;
  }

  async getCodeId(): Promise<number> {
    const result = await this.getWasmContractInfo();
    return result.codeId;
  }

  async getWasmContractInfo(): Promise<ContractInfoResponse> {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    return chainQuerier.getContractInfo({ contractAddr: this.address });
  }

  async getConfig() {
    const chainQuerier = await CosmwasmQuerier.connect(this.chain.endpoint);
    const allStates = (await chainQuerier.getAllContractState({
      contractAddr: this.address,
    })) as Record<string, string>;
    const config = {
      config_v1: JSON.parse(allStates["\x00\tconfig_v1"]),
      contract_version: allStates["\x00\x10contract_version"]
        ? JSON.parse(allStates["\x00\x10contract_version"])
        : undefined,
    };
    return config;
  }

  async getLastExecutedGovernanceSequence() {
    const config = await this.getConfig();
    return Number(config.config_v1.governance_sequence_number);
  }

  private parsePrice(priceInfo: Price) {
    return {
      conf: priceInfo.conf.toString(),
      publishTime: priceInfo.publish_time.toString(),
      expo: priceInfo.expo.toString(),
      price: priceInfo.price.toString(),
    };
  }

  async getPriceFeed(feedId: string) {
    const querier = await this.getQuerier();
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
    dataSources1: WormholeSource[],
    dataSources2: WormholeSource[],
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
    const config = await this.getConfig();
    const convertDataSource = (source: DataSource) => {
      return {
        emitter: Buffer.from(source.emitterAddress, "hex").toString("base64"),
        chain_id: source.emitterChain,
      };
    };
    const stableDataSources =
      getDefaultDeploymentConfig("stable").dataSources.map(convertDataSource);
    const betaDataSources =
      getDefaultDeploymentConfig("beta").dataSources.map(convertDataSource);
    if (this.equalDataSources(config.config_v1.data_sources, stableDataSources))
      return "stable";
    else if (
      this.equalDataSources(config.config_v1.data_sources, betaDataSources)
    )
      return "beta";
    else return "unknown";
  }

  async executeUpdatePriceFeed(senderPrivateKey: PrivateKey, vaas: Buffer[]) {
    const base64Vaas = vaas.map((v) => v.toString("base64"));
    const fund = await this.getUpdateFee(base64Vaas);
    const executor = await this.chain.getExecutor(senderPrivateKey);
    const pythExecutor = new PythWrapperExecutor(executor);
    const result = await pythExecutor.executeUpdatePriceFeeds({
      contractAddr: this.address,
      vaas: base64Vaas,
      fund,
    });
    return { id: result.txHash, info: result };
  }

  async executeGovernanceInstruction(privateKey: PrivateKey, vaa: Buffer) {
    const executor = await this.chain.getExecutor(privateKey);
    const pythExecutor = new PythWrapperExecutor(executor);
    const result = await pythExecutor.executeGovernanceInstruction({
      contractAddr: this.address,
      vaa: vaa.toString("base64"),
    });
    return { id: result.txHash, info: result };
  }

  async getWormholeContract(): Promise<CosmWasmWormholeContract> {
    const config = await this.getConfig();
    const wormholeAddress = config.config_v1.wormhole_contract;
    return new CosmWasmWormholeContract(this.chain, wormholeAddress);
  }

  async getUpdateFee(msgs: string[]): Promise<Coin> {
    const querier = await this.getQuerier();
    return querier.getUpdateFee(this.address, msgs);
  }

  async getBaseUpdateFee(): Promise<{ amount: string; denom: string }> {
    const config = await this.getConfig();
    return config.config_v1.fee;
  }

  async getVersion(): Promise<string> {
    const config = await this.getConfig();
    return config.contract_version;
  }

  getChain(): CosmWasmChain {
    return this.chain;
  }

  async getTotalFee(): Promise<TokenQty> {
    const client = await CosmWasmClient.connect(this.chain.endpoint);
    const coin = await client.getBalance(
      this.address,
      this.getChain().feeDenom,
    );
    return {
      amount: BigInt(coin.amount),
      denom: this.chain.getNativeToken(),
    };
  }

  async getValidTimePeriod() {
    const client = await CosmWasmClient.connect(this.chain.endpoint);
    const result = await client.queryContractSmart(
      this.address,
      "get_valid_time_period",
    );
    return Number(result.secs + result.nanos * 1e-9);
  }
}

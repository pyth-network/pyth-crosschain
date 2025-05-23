import { PriceFeedContract, PriceFeed, PrivateKey, TxResult } from "../base";
import { ApiError, BCS, CoinClient, TxnBuilderTypes } from "aptos";
import { AptosChain, Chain } from "../chains";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { WormholeContract } from "./wormhole";
import { TokenQty } from "../token";

type WormholeState = {
  chain_id: { number: string };
  guardian_set_index: { number: string };
  guardian_sets: { handle: string };
};

type GuardianSet = {
  guardians: { address: { bytes: string } }[];
  expiration_time: { number: string };
  index: { number: string };
};

export class AptosWormholeContract extends WormholeContract {
  static type = "AptosWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return AptosWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: AptosWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    },
  ): AptosWormholeContract {
    if (parsed.type !== AptosWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof AptosChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new AptosWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: AptosChain,
    public address: string,
  ) {
    super();
  }

  async getState(): Promise<WormholeState> {
    const client = this.chain.getClient();
    const resources = await client.getAccountResources(this.address);
    const type = "WormholeState";
    for (const resource of resources) {
      if (resource.type === `${this.address}::state::${type}`) {
        return resource.data as WormholeState;
      }
    }
    throw new Error(`${type} resource not found in account ${this.address}`);
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const data = await this.getState();
    return Number(data.guardian_set_index.number);
  }

  async getChainId(): Promise<number> {
    const data = await this.getState();
    return Number(data.chain_id.number);
  }

  public getChain(): AptosChain {
    return this.chain;
  }

  async getGuardianSet(): Promise<string[]> {
    const data = await this.getState();
    const client = this.chain.getClient();
    const result = (await client.getTableItem(data.guardian_sets.handle, {
      key_type: `u64`,
      value_type: `${this.address}::structs::GuardianSet`,
      key: data.guardian_set_index.number.toString(),
    })) as GuardianSet;
    return result.guardians.map((guardian) => guardian.address.bytes);
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this.address}::guardian_set_upgrade`,
        "submit_vaa_entry",
        [],
        [BCS.bcsSerializeBytes(vaa)],
      ),
    );
    return this.chain.sendTransaction(senderPrivateKey, txPayload);
  }
}

export class AptosPriceFeedContract extends PriceFeedContract {
  static type = "AptosPriceFeedContract";

  /**
   * Given the ids of the pyth state and wormhole state, create a new AptosContract
   * The package ids are derived based on the state ids
   *
   * @param chain the chain which this contract is deployed on
   * @param stateId id of the pyth state for the deployed contract
   * @param wormholeStateId id of the wormhole state for the wormhole contract that pyth binds to
   */
  constructor(
    public chain: AptosChain,
    public stateId: string,
    public wormholeStateId: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      stateId: string;
      wormholeStateId: string;
    },
  ): AptosPriceFeedContract {
    if (parsed.type !== AptosPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof AptosChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new AptosPriceFeedContract(
      chain,
      parsed.stateId,
      parsed.wormholeStateId,
    );
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this.stateId}::governance`,
        "execute_governance_instruction",
        [],
        [BCS.bcsSerializeBytes(vaa)],
      ),
    );
    return this.chain.sendTransaction(senderPrivateKey, txPayload);
  }

  public getWormholeContract(): AptosWormholeContract {
    return new AptosWormholeContract(this.chain, this.wormholeStateId);
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this.stateId}::pyth`,
        "update_price_feeds_with_funder",
        [],
        [BCS.serializeVectorWithFunc(vaas, "serializeBytes")],
      ),
    );
    return this.chain.sendTransaction(senderPrivateKey, txPayload);
  }

  getStateResources() {
    const client = this.chain.getClient();
    return client.getAccountResources(this.stateId);
  }

  /**
   * Returns the first occurrence of a resource with the given type in the pyth package state
   * @param type
   */
  async findResource(type: string) {
    const resources = await this.getStateResources();
    for (const resource of resources) {
      if (resource.type === `${this.stateId}::state::${type}`) {
        return resource.data;
      }
    }
    throw new Error(`${type} resource not found in state ${this.stateId}`);
  }

  async getBaseUpdateFee() {
    const data = (await this.findResource("BaseUpdateFee")) as { fee: string };
    return { amount: data.fee };
  }

  getChain(): AptosChain {
    return this.chain;
  }

  private parsePrice(priceInfo: {
    expo: { magnitude: string; negative: boolean };
    price: { magnitude: string; negative: boolean };
    conf: string;
    timestamp: string;
  }) {
    let expo = priceInfo.expo.magnitude;
    if (priceInfo.expo.negative) expo = "-" + expo;
    let price = priceInfo.price.magnitude;
    if (priceInfo.price.negative) price = "-" + price;
    return {
      conf: priceInfo.conf,
      publishTime: priceInfo.timestamp,
      expo,
      price,
    };
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const client = this.chain.getClient();
    const res = (await this.findResource("LatestPriceInfo")) as {
      info: { handle: string };
    };
    const handle = res.info.handle;
    try {
      const priceItemRes = await client.getTableItem(handle, {
        key_type: `${this.stateId}::price_identifier::PriceIdentifier`,
        value_type: `${this.stateId}::price_info::PriceInfo`,
        key: {
          bytes: feedId,
        },
      });
      return {
        price: this.parsePrice(priceItemRes.price_feed.price),
        emaPrice: this.parsePrice(priceItemRes.price_feed.ema_price),
      };
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === "table_item_not_found")
        return undefined;
      throw e;
    }
  }

  async getDataSources(): Promise<DataSource[]> {
    const data = (await this.findResource("DataSources")) as {
      sources: {
        keys: {
          emitter_chain: string;
          emitter_address: { external_address: string };
        }[];
      };
    };
    return data.sources.keys.map((source) => {
      return {
        emitterChain: Number(source.emitter_chain),
        emitterAddress: source.emitter_address.external_address.replace(
          "0x",
          "",
        ),
      };
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const data = (await this.findResource("GovernanceDataSource")) as {
      source: {
        emitter_chain: string;
        emitter_address: { external_address: string };
      };
    };
    return {
      emitterChain: Number(data.source.emitter_chain),
      emitterAddress: data.source.emitter_address.external_address.replace(
        "0x",
        "",
      ),
    };
  }

  async getLastExecutedGovernanceSequence() {
    const data = (await this.findResource(
      "LastExecutedGovernanceSequence",
    )) as { sequence: string };
    return Number(data.sequence);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return AptosPriceFeedContract.type;
  }

  async getTotalFee(): Promise<TokenQty> {
    const client = new CoinClient(this.chain.getClient());
    const amount = await client.checkBalance(this.stateId);
    return {
      amount,
      denom: this.chain.getNativeToken(),
    };
  }

  async getValidTimePeriod() {
    const data = (await this.findResource("StalePriceThreshold")) as {
      threshold_secs: string;
    };
    return Number(data.threshold_secs);
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      wormholeStateId: this.wormholeStateId,
      type: AptosPriceFeedContract.type,
    };
  }
}

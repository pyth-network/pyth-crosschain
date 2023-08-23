import { Contract, PriceFeed } from "../base";
import { AptosAccount, BCS, TxnBuilderTypes } from "aptos";
import { AptosChain, Chain } from "../chains";
import { DataSource } from "xc_admin_common";
import { CoinClient } from "aptos";

export class AptosContract extends Contract {
  static type: string = "AptosContract";

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
    public wormholeStateId: string
  ) {
    super();
  }

  static fromJson(chain: Chain, parsed: any): AptosContract {
    if (parsed.type !== AptosContract.type) throw new Error("Invalid type");
    if (!(chain instanceof AptosChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new AptosContract(chain, parsed.stateId, parsed.wormholeStateId);
  }

  async executeGovernanceInstruction(
    senderPrivateKey: string,
    vaa: Buffer
  ): Promise<any> {
    const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this.stateId}::governance`,
        "execute_governance_instruction",
        [],
        [BCS.bcsSerializeBytes(vaa)]
      )
    );
    return this.sendTransaction(senderPrivateKey, txPayload);
  }

  private sendTransaction(
    senderPrivateKey: string,
    txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ) {
    const client = this.chain.getClient();
    const sender = new AptosAccount(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex"))
    );
    return client.generateSignSubmitWaitForTransaction(sender, txPayload, {
      maxGasAmount: BigInt(30000),
    });
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: string,
    vaas: Buffer[]
  ): Promise<any> {
    const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this.stateId}::pyth`,
        "update_price_feeds_with_funder",
        [],
        [BCS.serializeVectorWithFunc(vaas, "serializeBytes")]
      )
    );
    return this.sendTransaction(senderPrivateKey, txPayload);
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
    const data = (await this.findResource("BaseUpdateFee")) as any;
    return { amount: data.fee };
  }

  getChain(): AptosChain {
    return this.chain;
  }

  private parsePrice(priceInfo: any) {
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
    const res = (await this.findResource("LatestPriceInfo")) as any;
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
    } catch (e: any) {
      if (e.errorCode === "table_item_not_found") return undefined;
      throw e;
    }
  }

  async getDataSources(): Promise<DataSource[]> {
    const data = (await this.findResource("DataSources")) as any;
    return data.sources.keys.map((source: any) => {
      return {
        emitterChain: Number(source.emitter_chain),
        emitterAddress: source.emitter_address.external_address.replace(
          "0x",
          ""
        ),
      };
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const data = (await this.findResource("GovernanceDataSource")) as any;
    return {
      emitterChain: Number(data.source.emitter_chain),
      emitterAddress: data.source.emitter_address.external_address.replace(
        "0x",
        ""
      ),
    };
  }

  async getLastExecutedGovernanceSequence() {
    const data = (await this.findResource(
      "LastExecutedGovernanceSequence"
    )) as any;
    return Number(data.sequence);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return AptosContract.type;
  }

  async getTotalFee(): Promise<bigint> {
    const client = new CoinClient(this.chain.getClient());
    return await client.checkBalance(this.stateId);
  }

  async getValidTimePeriod() {
    const data = (await this.findResource("StalePriceThreshold")) as any;
    return Number(data.threshold_secs);
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      wormholeStateId: this.wormholeStateId,
      type: AptosContract.type,
    };
  }
}

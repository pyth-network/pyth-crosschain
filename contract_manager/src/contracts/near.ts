import { DataSource } from "@pythnetwork/xc-admin-common";
import {
  KeyValueConfig,
  PriceFeed,
  PriceFeedContract,
  PrivateKey,
  TxResult,
} from "../base";
import { Chain, NearChain } from "../chains";
import * as nearAPI from "near-api-js";
import * as bs58 from "bs58";
import { BN } from "fuels";

export class NearPriceFeedContract extends PriceFeedContract {
  public static type = "NearPriceFeedContract";

  constructor(public chain: NearChain, public address: string) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string }
  ): NearPriceFeedContract {
    if (parsed.type !== NearPriceFeedContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof NearChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new NearPriceFeedContract(chain, parsed.address);
  }

  getChain(): NearChain {
    return this.chain;
  }

  async getContractNearAccount(
    senderPrivateKey?: PrivateKey
  ): Promise<nearAPI.Account> {
    return await this.chain.getNearAccount(this.address, senderPrivateKey);
  }

  async getValidTimePeriod(): Promise<number> {
    const account = await this.getContractNearAccount();
    return account.viewFunction({
      contractId: this.address,
      methodName: "get_stale_threshold",
    });
  }

  async getDataSources(): Promise<DataSource[]> {
    const account = await this.getContractNearAccount();
    const outcome: [{ emitter: number[]; chain: number }] =
      await account.viewFunction({
        contractId: this.address,
        methodName: "get_sources",
      });
    return outcome.map((item) => {
      return {
        emitterChain: item.chain,
        emitterAddress: Buffer.from(item.emitter).toString("hex"),
      };
    });
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const account = await this.getContractNearAccount();
    const price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    } | null = await account.viewFunction({
      contractId: this.address,
      methodName: "get_price_unsafe",
      args: { price_identifier: feedId },
    });
    const emaPrice: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    } | null = await account.viewFunction({
      contractId: this.address,
      methodName: "get_ema_price_unsafe",
      args: { price_id: feedId },
    });
    if (price === null || emaPrice === null) {
      return undefined;
    } else {
      return {
        price: {
          price: price.price,
          conf: price.conf,
          expo: price.expo.toString(),
          publishTime: price.publish_time.toString(),
        },
        emaPrice: {
          price: emaPrice.price,
          conf: emaPrice.conf,
          expo: emaPrice.expo.toString(),
          publishTime: emaPrice.publish_time.toString(),
        },
      };
    }
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[]
  ): Promise<TxResult> {
    if (vaas.length === 0) {
      throw new Error("no vaas specified");
    }
    const address = await this.chain.getAccountAddress(senderPrivateKey);
    const account = await this.chain.getNearAccount(address, senderPrivateKey);
    let results = [];
    for (let vaa of vaas) {
      const outcome = await account.functionCall({
        contractId: this.address,
        methodName: "update_price_feeds",
        args: { data: vaa.toString("hex") },
        gas: new BN(300e12),
        attachedDeposit: new BN(1e12),
      });
      console.log("outcome", outcome);
      results.push({ id: outcome.transaction.hash, info: outcome });
    }
    if (results.length === 1) {
      return results[0];
    } else {
      return {
        id: results.map((x) => x.id).join(","),
        info: results.map((x) => x.info),
      };
    }
  }

  getBaseUpdateFee(): Promise<{ amount: string; denom?: string }> {
    throw new Error("near contract doesn't implement getBaseUpdateFee method");
  }
  getLastExecutedGovernanceSequence(): Promise<number> {
    throw new Error(
      "near contract doesn't implement getLastExecutedGovernanceSequence method"
    );
  }

  executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ): Promise<TxResult> {
    throw new Error("Method not implemented.");
  }
  getGovernanceDataSource(): Promise<DataSource> {
    throw new Error("Method not implemented.");
  }
  getId(): string {
    return `${this.chain.getId()}_${this.address.replace(/-|\./g, "_")}`;
  }
  getType(): string {
    return NearPriceFeedContract.type;
  }
  toJson(): KeyValueConfig {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: NearPriceFeedContract.type,
    };
  }
}

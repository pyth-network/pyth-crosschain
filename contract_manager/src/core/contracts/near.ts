/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
import type { DataSource } from "@pythnetwork/xc-admin-common";
import { BN } from "fuels";
import * as nearAPI from "near-api-js";

import type { KeyValueConfig, PriceFeed, PrivateKey, TxResult } from "../base";
import { PriceFeedContract } from "../base";
import { Chain, NearChain } from "../chains";
import { WormholeContract } from "./wormhole";

export class NearWormholeContract extends WormholeContract {
  static type = "NearWormholeContract";

  constructor(
    public chain: NearChain,
    public address: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}__${this.address.replaceAll(/-|\./g, "_")}`;
  }

  getChain(): NearChain {
    return this.chain;
  }

  getType(): string {
    return NearWormholeContract.type;
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): NearWormholeContract {
    if (parsed.type !== NearWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof NearChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new NearWormholeContract(chain, parsed.address);
  }

  toJson(): KeyValueConfig {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: NearWormholeContract.type,
    };
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const account = await this.chain.getNearAccount(
      senderAddress,
      senderPrivateKey,
    );
    const outcome = await account.functionCall({
      contractId: this.address,
      methodName: "submit_vaa",
      args: { vaa: vaa.toString("hex") },
      gas: new BN(300e12),
      attachedDeposit: new BN(1e12),
    });
    return { id: outcome.transaction.hash, info: outcome };
  }

  getCurrentGuardianSetIndex(): Promise<number> {
    throw new Error(
      "near wormhole contract doesn't implement getCurrentGuardianSetIndex method",
    );
  }
  getChainId(): Promise<number> {
    throw new Error(
      "near wormhole contract doesn't implement getChainId method",
    );
  }
  getGuardianSet(): Promise<string[]> {
    throw new Error(
      "near wormhole contract doesn't implement getGuardianSet method",
    );
  }
}

export class NearPriceFeedContract extends PriceFeedContract {
  public static type = "NearPriceFeedContract";

  constructor(
    public chain: NearChain,
    public address: string,
    public governanceDataSource: DataSource,
    public lastExecutedGovernanceSequence: number,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}__${this.address.replaceAll(/-|\./g, "_")}`;
  }

  getType(): string {
    return NearPriceFeedContract.type;
  }

  getChain(): NearChain {
    return this.chain;
  }

  toJson(): KeyValueConfig {
    return {
      chain: this.chain.getId(),
      address: this.address,
      governanceDataSourceChain: this.governanceDataSource.emitterChain,
      governanceDataSourceAddress: this.governanceDataSource.emitterAddress,
      lastExecutedGovernanceSequence: this.lastExecutedGovernanceSequence,
      type: NearPriceFeedContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
      governanceDataSourceAddress: string;
      governanceDataSourceChain: number;
      lastExecutedGovernanceSequence: number;
    },
  ): NearPriceFeedContract {
    if (parsed.type !== NearPriceFeedContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof NearChain)) {
      throw new TypeError(`Wrong chain type ${chain}`);
    }
    return new NearPriceFeedContract(
      chain,
      parsed.address,
      {
        emitterAddress: parsed.governanceDataSourceAddress,
        emitterChain: parsed.governanceDataSourceChain,
      },
      parsed.lastExecutedGovernanceSequence,
    );
  }

  async getContractNearAccount(
    senderPrivateKey?: PrivateKey,
  ): Promise<nearAPI.Account> {
    return await this.chain.getNearAccount(this.address, senderPrivateKey);
  }

  async getValidTimePeriod(): Promise<number> {
    const account = await this.getContractNearAccount();
    const result = await account.viewFunction({
      contractId: this.address,
      methodName: "get_stale_threshold",
    });

    return Number(result);
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
    return price === null || emaPrice === null
      ? undefined
      : {
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

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    if (vaas.length === 0) {
      throw new Error("no vaas specified");
    }
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const account = await this.chain.getNearAccount(
      senderAddress,
      senderPrivateKey,
    );
    const results = [];
    for (const vaa of vaas) {
      const outcome = await account.functionCall({
        contractId: this.address,
        methodName: "update_price_feeds",
        args: { data: vaa.toString("hex") },
        gas: new BN(300e12),
        attachedDeposit: new BN(1e12),
      });
      results.push({ id: outcome.transaction.hash, info: outcome });
    }
    return results.length === 1
      ? results[0]!
      : {
          id: results.map((x) => x.id).join(","),
          info: results.map((x) => x.info),
        };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const account = await this.chain.getNearAccount(
      senderAddress,
      senderPrivateKey,
    );
    const outcome = await account.functionCall({
      contractId: this.address,
      methodName: "execute_governance_instruction",
      args: { vaa: vaa.toString("hex") },
      gas: new BN(300e12),
      attachedDeposit: new BN(1e12),
    });
    return { id: outcome.transaction.hash, info: outcome };
  }

  getBaseUpdateFee(): Promise<{ amount: string; denom?: string }> {
    throw new Error("near contract doesn't implement getBaseUpdateFee method");
  }
  async getLastExecutedGovernanceSequence(): Promise<number> {
    // near contract doesn't implement getLastExecutedGovernanceSequence method
    return this.lastExecutedGovernanceSequence;
  }
  async getGovernanceDataSource(): Promise<DataSource> {
    // near contract doesn't implement getGovernanceDataSource method
    return this.governanceDataSource;
  }
}

/** biome-ignore-all lint/suspicious/noConsole: utils used through CLI */
import {
  calculateUpdatePriceFeedsFee,
  PythContract,
} from "@pythnetwork/pyth-ton-js";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import type { Cell, OpenedContract } from "@ton/ton";
import { Address } from "@ton/ton";

import type { PriceFeed, PrivateKey, TxResult } from "../base";
import { PriceFeedContract } from "../base";
import type { Chain } from "../chains";
import { TonChain } from "../chains";
import type { TokenQty } from "../token";
import { WormholeContract } from "./wormhole";

export class TonWormholeContract extends WormholeContract {
  static type = "TonWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}_${TonWormholeContract.type}`;
  }

  getChain(): TonChain {
    return this.chain;
  }

  getType(): string {
    return TonWormholeContract.type;
  }

  toJson() {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: TonWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    },
  ): TonWormholeContract {
    if (parsed.type !== TonWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof TonChain))
      throw new Error(`Wrong chain type ${JSON.stringify(chain)}`);
    return new TonWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: TonChain,
    public address: string,
  ) {
    super();
  }

  getContract(): OpenedContract<PythContract> {
    const provider = this.chain.getContractProvider(this.address);
    const contract = provider.open(
      PythContract.createFromAddress(Address.parse(this.address)),
    );

    return contract;
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const contract = this.getContract();
    const result = await contract.getCurrentGuardianSetIndex();
    return result;
  }

  async getChainId(): Promise<number> {
    const contract = this.getContract();
    const result = await contract.getChainId();
    return Number(result);
  }

  async getGuardianSet(): Promise<string[]> {
    const contract = this.getContract();
    const guardianSetIndex = await this.getCurrentGuardianSetIndex();
    const result = await contract.getGuardianSet(guardianSetIndex);
    return result.keys;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const contract = this.getContract();
    const provider = this.chain.getContractProvider(this.address);
    const sender = this.chain.getSender(senderPrivateKey);
    const wallet = this.chain.getWallet(senderPrivateKey);
    await contract.sendUpdateGuardianSet(sender, vaa);

    // Get recent transactions for this address
    const transactions = await provider.getTransactions(
      wallet.address,
      BigInt(0),
      Buffer.alloc(0),
      1,
    );

    return {
      id: transactions[0]?.hash.toString() ?? "",
      info: JSON.stringify("0x1"),
    };
  }
}

export class TonPriceFeedContract extends PriceFeedContract {
  static type = "TonPriceFeedContract";

  constructor(
    public chain: TonChain,
    public address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): TonPriceFeedContract {
    if (parsed.type !== TonPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof TonChain))
      throw new Error(`Wrong chain type ${JSON.stringify(chain)}`);
    return new TonPriceFeedContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}_${TonPriceFeedContract.type}`;
  }

  getChain(): TonChain {
    return this.chain;
  }

  getType(): string {
    return TonPriceFeedContract.type;
  }

  getContract(): OpenedContract<PythContract> {
    const provider = this.chain.getContractProvider(this.address);
    const contract = provider.open(
      PythContract.createFromAddress(Address.parse(this.address)),
    );

    return contract;
  }

  async getTotalFee(): Promise<TokenQty> {
    const client = this.chain.getClient();
    const balance = await client.getBalance(Address.parse(this.address));
    return {
      amount: balance,
      denom: this.chain.getNativeToken(),
    };
  }

  async getLastExecutedGovernanceSequence(): Promise<number> {
    const contract = this.getContract();
    const result = await contract.getLastExecutedGovernanceSequence();
    return Number(result);
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const contract = this.getContract();
    const feedIdWithPrefix = `0x${feedId}`;
    try {
      const price = await contract.getPriceUnsafe(feedIdWithPrefix);
      const emaPrice = await contract.getEmaPriceUnsafe(feedIdWithPrefix);
      return {
        emaPrice: {
          conf: emaPrice.conf.toString(),
          expo: emaPrice.expo.toString(),
          price: emaPrice.price.toString(),
          publishTime: emaPrice.publishTime.toString(),
        },
        price: {
          conf: price.conf.toString(),
          expo: price.expo.toString(),
          price: price.price.toString(),
          publishTime: price.publishTime.toString(),
        },
      };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  getValidTimePeriod(): Promise<number> {
    // Not supported but return 1 because it's required by the abstract class
    return Promise.resolve(1);
  }

  getWormholeContract(): TonWormholeContract {
    // Price feed contract and wormhole contract live at same address in TON
    return new TonWormholeContract(this.chain, this.address);
  }

  async getBaseUpdateFee() {
    const contract = this.getContract();
    const amount = await contract.getSingleUpdateFee();
    return {
      amount: amount.toString(),
      denom: this.chain.getNativeToken(),
    };
  }

  async getDataSources(): Promise<DataSource[]> {
    const contract = this.getContract();
    const dataSources = await contract.getDataSources();
    return dataSources.map((ds: DataSource) => ({
      emitterAddress: ds.emitterAddress.replace("0x", ""),
      emitterChain: ds.emitterChain,
    }));
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const contract = this.getContract();
    const result = await contract.getGovernanceDataSource();
    if (result === null) {
      throw new Error("Governance data source not found");
    }
    return {
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      emitterAddress: result!.emitterAddress,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      emitterChain: result!.emitterChain,
    };
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const client = this.chain.getClient();
    const contract = this.getContract();
    const wallet = this.chain.getWallet(senderPrivateKey);
    const sender = this.chain.getSender(senderPrivateKey);
    for (const vaa of vaas) {
      const fee = await contract.getUpdateFee(vaa);
      console.log(fee);
      await contract.sendUpdatePriceFeeds(
        sender,
        vaa,
        calculateUpdatePriceFeedsFee(BigInt(fee)) + BigInt(fee),
      );
    }

    const txDetails = await client.getTransactions(wallet.address, {
      limit: 1,
    });
    const txHash = Buffer.from(
      txDetails[0]?.hash() ?? Buffer.alloc(0),
    ).toString("hex");
    const txInfo = JSON.stringify(
      txDetails[0]?.description ?? "{}",
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
    );

    return {
      id: txHash,
      info: txInfo,
    };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const client = this.chain.getClient();
    const contract = this.getContract();
    const wallet = this.chain.getWallet(senderPrivateKey);
    const sender = this.chain.getSender(senderPrivateKey);
    await contract.sendExecuteGovernanceAction(sender, vaa);

    const txDetails = await client.getTransactions(wallet.address, {
      limit: 1,
    });
    const txHash = Buffer.from(
      txDetails[0]?.hash() ?? Buffer.alloc(0),
    ).toString("hex");
    const txInfo = JSON.stringify(
      txDetails[0]?.description ?? "{}",
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
    );

    return {
      id: txHash,
      info: txInfo,
    };
  }

  async upgradeContract(
    senderPrivateKey: PrivateKey,
    newCode: Cell,
  ): Promise<TxResult> {
    const client = this.chain.getClient();
    const contract = this.getContract();
    const wallet = this.chain.getWallet(senderPrivateKey);
    const sender = this.chain.getSender(senderPrivateKey);
    await contract.sendUpgradeContract(sender, newCode);

    const txDetails = await client.getTransactions(wallet.address, {
      limit: 1,
    });
    const txHash = Buffer.from(
      txDetails[0]?.hash() ?? Buffer.alloc(0),
    ).toString("hex");
    const txInfo = JSON.stringify(
      txDetails[0]?.description ?? "{}",
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
    );

    return {
      id: txHash,
      info: txInfo,
    };
  }

  toJson() {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: TonPriceFeedContract.type,
    };
  }
}

import { Chain, TonChain } from "../chains";
import { WormholeContract } from "./wormhole";
import { PriceFeed, PriceFeedContract, PrivateKey, TxResult } from "../base";
import { TokenQty } from "../token";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { Address, Cell, OpenedContract } from "@ton/ton";
import {
  calculateUpdatePriceFeedsFee,
  PythContract,
} from "@pythnetwork/pyth-ton-js";

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
      chain: this.chain.getId(),
      address: this.address,
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
      throw new Error(`Wrong chain type ${chain}`);
    return new TonWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: TonChain,
    public address: string,
  ) {
    super();
  }

  async getContract(): Promise<OpenedContract<PythContract>> {
    const provider = await this.chain.getContractProvider(this.address);
    const contract = provider.open(
      PythContract.createFromAddress(Address.parse(this.address)),
    );

    return contract;
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.getCurrentGuardianSetIndex();
    return result;
  }

  async getChainId(): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.getChainId();
    return Number(result);
  }

  async getGuardianSet(): Promise<string[]> {
    const contract = await this.getContract();
    const guardianSetIndex = await this.getCurrentGuardianSetIndex();
    const result = await contract.getGuardianSet(guardianSetIndex);
    return result.keys;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const contract = await this.getContract();
    const provider = await this.chain.getContractProvider(this.address);
    const sender = await this.chain.getSender(senderPrivateKey);
    const wallet = await this.chain.getWallet(senderPrivateKey);
    await contract.sendUpdateGuardianSet(sender, vaa);

    // Get recent transactions for this address
    const transactions = await provider.getTransactions(
      wallet.address,
      BigInt(0),
      Buffer.alloc(0),
      1,
    );

    return {
      id: transactions[0].hash.toString(),
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
      throw new Error(`Wrong chain type ${chain}`);
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

  async getContract(): Promise<OpenedContract<PythContract>> {
    const provider = await this.chain.getContractProvider(this.address);
    const contract = provider.open(
      PythContract.createFromAddress(Address.parse(this.address)),
    );

    return contract;
  }

  async getTotalFee(): Promise<TokenQty> {
    const client = await this.chain.getClient();
    const balance = await client.getBalance(Address.parse(this.address));
    return {
      amount: balance,
      denom: this.chain.getNativeToken(),
    };
  }

  async getLastExecutedGovernanceSequence(): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.getLastExecutedGovernanceSequence();
    return Number(result);
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const contract = await this.getContract();
    const feedIdWithPrefix = `0x${feedId}`;
    try {
      const price = await contract.getPriceUnsafe(feedIdWithPrefix);
      const emaPrice = await contract.getEmaPriceUnsafe(feedIdWithPrefix);
      return {
        price: {
          price: price.price.toString(),
          conf: price.conf.toString(),
          expo: price.expo.toString(),
          publishTime: price.publishTime.toString(),
        },
        emaPrice: {
          price: emaPrice.price.toString(),
          conf: emaPrice.conf.toString(),
          expo: emaPrice.expo.toString(),
          publishTime: emaPrice.publishTime.toString(),
        },
      };
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async getValidTimePeriod(): Promise<number> {
    // Not supported but return 1 because it's required by the abstract class
    return 1;
  }

  async getWormholeContract(): Promise<TonWormholeContract> {
    // Price feed contract and wormhole contract live at same address in TON
    return new TonWormholeContract(this.chain, this.address);
  }

  async getBaseUpdateFee() {
    const contract = await this.getContract();
    const amount = await contract.getSingleUpdateFee();
    return {
      amount: amount.toString(),
      denom: this.chain.getNativeToken(),
    };
  }

  async getDataSources(): Promise<DataSource[]> {
    const contract = await this.getContract();
    const dataSources = await contract.getDataSources();
    return dataSources.map((ds: DataSource) => ({
      emitterChain: ds.emitterChain,
      emitterAddress: ds.emitterAddress.replace("0x", ""),
    }));
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const contract = await this.getContract();
    const result = await contract.getGovernanceDataSource();
    if (result === null) {
      throw new Error("Governance data source not found");
    }
    return {
      emitterChain: result.emitterChain,
      emitterAddress: result.emitterAddress,
    };
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const client = await this.chain.getClient();
    const contract = await this.getContract();
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const sender = await this.chain.getSender(senderPrivateKey);
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
    const txHash = Buffer.from(txDetails[0].hash()).toString("hex");
    const txInfo = JSON.stringify(txDetails[0].description, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
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
    const client = await this.chain.getClient();
    const contract = await this.getContract();
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const sender = await this.chain.getSender(senderPrivateKey);
    await contract.sendExecuteGovernanceAction(sender, vaa);

    const txDetails = await client.getTransactions(wallet.address, {
      limit: 1,
    });
    const txHash = Buffer.from(txDetails[0].hash()).toString("hex");
    const txInfo = JSON.stringify(txDetails[0].description, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
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
    const client = await this.chain.getClient();
    const contract = await this.getContract();
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const sender = await this.chain.getSender(senderPrivateKey);
    await contract.sendUpgradeContract(sender, newCode);

    const txDetails = await client.getTransactions(wallet.address, {
      limit: 1,
    });
    const txHash = Buffer.from(txDetails[0].hash()).toString("hex");
    const txInfo = JSON.stringify(txDetails[0].description, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );

    return {
      id: txHash,
      info: txInfo,
    };
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: TonPriceFeedContract.type,
    };
  }
}

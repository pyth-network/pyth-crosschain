import { Chain, TonChain } from "../chains";
import { WormholeContract } from "./wormhole";
import { PriceFeed, PriceFeedContract, PrivateKey, TxResult } from "../base";
import { TokenQty } from "../token";
import { DataSource } from "@pythnetwork/xc-admin-common";
import {
  Address,
  Contract,
  OpenedContract,
  TonClient,
  WalletContractV4,
} from "@ton/ton";
import {
  PythContract,
  PYTH_CONTRACT_ADDRESS_TESTNET,
} from "@pythnetwork/pyth-ton-js";

export class TonWormholeContract extends WormholeContract {
  static type = "TonWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}_${TonWormholeContract.type}`;
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
    }
  ): TonWormholeContract {
    if (parsed.type !== TonWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof TonChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new TonWormholeContract(chain, parsed.address);
  }

  constructor(public chain: TonChain, public address: string) {
    super();
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    // const contract = await this.getContract();
    // const result = await contract.get("get_current_guardian_set_index");
    // return Number(result);
    return 1;
  }

  async getChainId(): Promise<number> {
    // const contract = await this.getContract();
    // const result = await contract.get("get_chain_id");
    // return Number(result);
    return 1;
  }

  async getGuardianSet(): Promise<string[]> {
    // const contract = await this.getContract();
    // const guardianSetIndex = await this.getCurrentGuardianSetIndex();
    // const result = await contract.get("get_guardian_set", [guardianSetIndex]);
    // return result.map((guardian: string) => `0x${guardian}`);
    return ["0x1"];
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ): Promise<TxResult> {
    // const client = await this.chain.getClient(senderPrivateKey);
    // const contract = await this.getContract(client);

    // const tx = await contract.sendMessage({
    //   body: {
    //     op: "update_guardian_set",
    //     data: vaa,
    //   },
    //   value: "0.05", // TON to attach
    // });

    return {
      id: "0x1",
      info: JSON.stringify("0x1"),
    };
  }
}

export class TonPriceFeedContract extends PriceFeedContract {
  static type = "TonPriceFeedContract";

  constructor(public chain: TonChain, public address: string) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string }
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

  getType(): string {
    return TonPriceFeedContract.type;
  }

  async getContract(): Promise<OpenedContract<PythContract>> {
    const provider = await this.chain.getProvider(this.address);
    const contract = provider.open(
      PythContract.createFromAddress(Address.parse(this.address))
    );

    return contract;
  }

  async getTotalFee(): Promise<TokenQty> {
    // const contract = await this.getContract();
    // const balance = await contract.getBalance();
    return {
      amount: BigInt(0),
      denom: this.chain.getNativeToken(),
    };
  }

  async getLastExecutedGovernanceSequence(): Promise<number> {
    // const contract = await this.getContract();
    // const result = await contract.get
    // return Number(result);
    return 1;
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
    // const contract = await this.getContract();
    // const result = await contract.get("get_valid_time_period");
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
    // const contract = await this.getContract();
    // const result = await contract.get("get_data_sources");
    // return result.map((ds: any) => ({
    //   emitterChain: ds.emitterChain,
    //   emitterAddress: ds.emitterAddress.replace("0x", ""),
    // }));
    return [];
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    // const contract = await this.getContract();
    // const result = await contract.get("get_governance_data_source");
    return {
      emitterChain: 1,
      emitterAddress: "0x1",
    };
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[]
  ): Promise<TxResult> {
    // const client = await this.chain.getClient(senderPrivateKey);
    // const contract = await this.getContract(client);

    // const updateFee = await contract.get("get_update_fee", [vaas[0]]);

    // const tx = await contract.sendMessage({
    //   body: {
    //     op: "update_price_feeds",
    //     data: vaas[0], // TON contract expects single VAA
    //   },
    //   value: updateFee.toString(),
    // });

    return {
      id: "0x1",
      info: JSON.stringify("0x1"),
    };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ): Promise<TxResult> {
    // const client = await this.chain.getClient(senderPrivateKey);
    // const contract = await this.getContract(client);

    // const tx = await contract.sendMessage({
    //   body: {
    //     op: "execute_governance_action",
    //     data: vaa,
    //   },
    //   value: "0.05", // TON to attach
    // });

    return {
      id: "0x1",
      info: JSON.stringify("0x1"),
    };
  }

  getChain(): TonChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: TonPriceFeedContract.type,
    };
  }
}

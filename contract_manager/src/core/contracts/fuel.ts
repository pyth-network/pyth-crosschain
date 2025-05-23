import { Chain, FuelChain } from "../chains";
import { WormholeContract } from "./wormhole";
import {
  PYTH_CONTRACT_ABI as FuelContractAbi,
  FUEL_ETH_ASSET_ID,
  PriceFeedOutput,
  DataSourceOutput,
} from "@pythnetwork/pyth-fuel-js";

import {
  Account,
  Contract,
  Wallet,
  arrayify,
  hexlify,
  DryRunResult,
} from "fuels";
import { PriceFeed, PriceFeedContract, PrivateKey, TxResult } from "../base";

import { TokenQty } from "../token";
import { DataSource } from "@pythnetwork/xc-admin-common";

export class FuelWormholeContract extends WormholeContract {
  static type = "FuelWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}_${FuelWormholeContract.type}`;
  }

  getType(): string {
    return FuelWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: FuelWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    },
  ): FuelWormholeContract {
    if (parsed.type !== FuelWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof FuelChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new FuelWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: FuelChain,
    public address: string,
  ) {
    super();
  }

  async getContract(wallet?: Wallet): Promise<Contract> {
    const provider = await this.chain.getProvider();

    return new Contract(
      this.address,
      FuelContractAbi,
      wallet ? (wallet as Account) : provider,
    );
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const contract = await this.getContract();
    const guardianSetIndex = (
      await contract.functions.current_guardian_set_index().get()
    ).value;
    return guardianSetIndex;
  }

  async getChainId(): Promise<number> {
    const contract = await this.getContract();
    const chainId = (await contract.functions.chain_id().get()).value;
    return chainId;
  }

  async getGuardianSet(): Promise<string[]> {
    const contract = await this.getContract();
    const guardianSetIndex = await this.getCurrentGuardianSetIndex();
    const guardianSet = (
      await contract.functions.guardian_set(guardianSetIndex).get()
    ).value;
    return guardianSet;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const contract = await this.getContract(wallet);
    const tx = await contract.functions
      .submit_new_guardian_set(arrayify(vaa))
      .call(); // you might get `Error updating Guardianset for fuel_testnet_{address} TypeError: response.body.getReader is not a function` but the tx could still be successful, this is due to fuels using native fetch but some other packages in the monorepo is using node-fetch which overrides the fetch here

    const txResult = await tx.waitForResult();

    return {
      id: tx.transactionId,
      info: JSON.stringify(txResult.transactionResponse),
    };
  }
}

export class FuelPriceFeedContract extends PriceFeedContract {
  static type = "FuelPriceFeedContract";

  constructor(
    public chain: FuelChain,
    public address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): FuelPriceFeedContract {
    if (parsed.type !== FuelPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof FuelChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new FuelPriceFeedContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}_${
      FuelPriceFeedContract.type
    }`;
  }

  getType(): string {
    return FuelPriceFeedContract.type;
  }

  async getContract(wallet?: Wallet): Promise<Contract> {
    const provider = await this.chain.getProvider();

    return new Contract(
      this.address,
      FuelContractAbi,
      wallet ? (wallet as Account) : provider,
    );
  }

  async getTotalFee(): Promise<TokenQty> {
    const contract = await this.getContract();
    const balance = await contract.getBalance(this.address);
    return {
      amount: BigInt(balance.toString()),
      denom: this.chain.getNativeToken(),
    };
  }

  async getLastExecutedGovernanceSequence() {
    const pythContract = await this.getContract();
    return Number(
      (await pythContract.functions.last_executed_governance_sequence().get())
        .value,
    );
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const pythContract = await this.getContract();
    const feed = "0x" + feedId;
    const exists = (
      await pythContract.functions.price_feed_exists(hexlify(feed)).get()
    ).value;
    if (!exists) {
      return undefined;
    }
    const priceFeed: PriceFeedOutput = (
      await pythContract.functions.price_feed_unsafe(feed).get()
    ).value;
    return {
      price: {
        price: priceFeed.price.price.toString(),
        conf: priceFeed.price.confidence.toString(),
        expo: priceFeed.price.exponent.toString(),
        publishTime: priceFeed.price.publish_time.toString(),
      },
      emaPrice: {
        price: priceFeed.ema_price.price.toString(),
        conf: priceFeed.ema_price.confidence.toString(),
        expo: priceFeed.ema_price.exponent.toString(),
        publishTime: priceFeed.ema_price.publish_time.toString(),
      },
    };
  }

  async getValidTimePeriod() {
    const pythContract = await this.getContract();
    const validTimePeriod = (
      await pythContract.functions.valid_time_period().get()
    ).value;
    return Number(validTimePeriod);
  }

  /**
   * Returns the wormhole contract which is being used for VAA verification
   */
  async getWormholeContract(): Promise<FuelWormholeContract> {
    //  price feed contract and wormhole contract lives on the same address in fuel
    return new FuelWormholeContract(this.chain, this.address);
  }

  async getBaseUpdateFee() {
    const pythContract = await this.getContract();
    const amount = (await pythContract.functions.single_update_fee().get())
      .value;
    return {
      amount: amount.toString(),
      denom: this.chain.getNativeToken(),
    };
  }

  async getDataSources(): Promise<DataSource[]> {
    const pythContract = await this.getContract();
    const result: DryRunResult<DataSourceOutput[]> =
      await pythContract.functions.valid_data_sources().get();
    return result.value.map(
      ({
        chain_id,
        emitter_address,
      }: {
        chain_id: number;
        emitter_address: string;
      }) => {
        return {
          emitterChain: chain_id,
          emitterAddress: emitter_address.replace("0x", ""),
        };
      },
    );
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const pythContract = await this.getContract();
    const result: DryRunResult<DataSourceOutput> = await pythContract.functions
      .governance_data_source()
      .get();
    return {
      emitterChain: result.value.chain_id,
      emitterAddress: result.value.emitter_address.replace("0x", ""),
    };
  }

  async executeUpdatePriceFeed(senderPrivateKey: PrivateKey, vaas: Buffer[]) {
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const contract = await this.getContract(wallet);
    const priceFeedUpdateData = vaas.map((vaa) => new Uint8Array(vaa));
    const updateFee: number = (
      await contract.functions.update_fee(priceFeedUpdateData).get()
    ).value;
    const tx = await contract.functions
      .update_price_feeds(priceFeedUpdateData)
      .callParams({
        forward: [updateFee, hexlify(FUEL_ETH_ASSET_ID)],
      })
      .call();

    const txResult = await tx.waitForResult();

    return { id: tx.transactionId, info: txResult.transactionResponse };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ) {
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const contract = await this.getContract(wallet);
    const tx = await contract.functions
      .execute_governance_instruction(arrayify(vaa))
      .call();

    const txResult = await tx.waitForResult();

    return { id: tx.transactionId, info: txResult.transactionResponse };
  }

  getChain(): FuelChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: FuelPriceFeedContract.type,
    };
  }
}

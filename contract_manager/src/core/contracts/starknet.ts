import { DataSource } from "@pythnetwork/xc-admin-common";
import {
  KeyValueConfig,
  Price,
  PriceFeed,
  PriceFeedContract,
  PrivateKey,
  TxResult,
} from "../base";
import { Chain, StarknetChain } from "../chains";
import { Account, Contract, shortString } from "starknet";
import { ByteBuffer } from "@pythnetwork/pyth-starknet-js";
import { WormholeContract } from "./wormhole";

export class StarknetWormholeContract extends WormholeContract {
  static type = "StarknetWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return StarknetWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: StarknetWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    },
  ): StarknetWormholeContract {
    if (parsed.type !== StarknetWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof StarknetChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new StarknetWormholeContract(chain, parsed.address);
  }

  constructor(
    public chain: StarknetChain,
    public address: string,
  ) {
    super();
  }

  async getContractClient(): Promise<Contract> {
    const provider = this.chain.getProvider();
    const classData = await provider.getClassAt(this.address);
    return new Contract(classData.abi, this.address, provider);
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const contract = await this.getContractClient();
    return Number(await contract.get_current_guardian_set_index());
  }

  async getChainId(): Promise<number> {
    const contract = await this.getContractClient();
    return Number(await contract.chain_id());
  }

  async getGuardianSet(): Promise<string[]> {
    const contract = await this.getContractClient();
    const setIndex = await contract.get_current_guardian_set_index();
    const set = await contract.get_guardian_set(setIndex);
    return set.keys.map((key: bigint) => key.toString(16).padStart(40, "0"));
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const provider = this.chain.getProvider();
    const contract = await this.getContractClient();
    const account = new Account(
      provider,
      "0x" + senderAddress,
      "0x" + senderPrivateKey,
    );
    contract.connect(account);

    const updateData = ByteBuffer.fromBuffer(vaa);
    const tx = await contract.submit_new_guardian_set(updateData);
    const info = await provider.waitForTransaction(tx.transaction_hash);
    return { id: tx.transaction_hash, info };
  }
}

export class StarknetPriceFeedContract extends PriceFeedContract {
  static type = "StarknetPriceFeedContract";

  constructor(
    public chain: StarknetChain,
    public address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    },
  ): StarknetPriceFeedContract {
    if (parsed.type !== StarknetPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof StarknetChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new StarknetPriceFeedContract(chain, parsed.address);
  }

  toJson(): KeyValueConfig {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: StarknetPriceFeedContract.type,
    };
  }

  // Not implemented in the Starknet contract.
  getValidTimePeriod(): Promise<number> {
    throw new Error("Unsupported");
  }

  getChain(): StarknetChain {
    return this.chain;
  }

  async getContractClient(): Promise<Contract> {
    const provider = this.chain.getProvider();
    const classData = await provider.getClassAt(this.address);
    return new Contract(classData.abi, this.address, provider);
  }

  async getDataSources(): Promise<DataSource[]> {
    const contract = await this.getContractClient();
    const sources: { emitter_chain_id: bigint; emitter_address: bigint }[] =
      await contract.valid_data_sources();
    return sources.map((source) => {
      return {
        emitterChain: Number(source.emitter_chain_id),
        emitterAddress: source.emitter_address.toString(16).padStart(64, "0"),
      };
    });
  }

  async getBaseUpdateFee(): Promise<{
    amount: string;
    denom?: string | undefined;
  }> {
    const tokens = await this.getFeeTokenAddresses();
    return await this.getBaseUpdateFeeInToken(tokens[0]);
  }

  /**
   * Returns the list of accepted fee tokens.
   * @returns hex encoded token addresses without 0x prefix
   */
  async getFeeTokenAddresses(): Promise<string[]> {
    const contract = await this.getContractClient();
    const tokens: bigint[] = await contract.fee_token_addresses();
    return tokens.map((t) => t.toString(16).padStart(64, "0"));
  }

  /**
   * Returns the single update fee and symbol of the specified token.
   * @param token hex encoded token address without 0x prefix
   */
  async getBaseUpdateFeeInToken(
    token: string,
  ): Promise<{ amount: string; denom?: string | undefined }> {
    token = "0x" + token;
    const provider = this.chain.getProvider();
    const contract = await this.getContractClient();
    const fee: bigint = await contract.get_single_update_fee(token);

    const tokenClassData = await provider.getClassAt(token);
    const tokenContract = new Contract(tokenClassData.abi, token, provider);
    const denom = shortString.decodeShortString(await tokenContract.symbol());
    return { amount: fee.toString(), denom };
  }

  async getLastExecutedGovernanceSequence(): Promise<number> {
    const contract = await this.getContractClient();
    return Number(await contract.last_executed_governance_sequence());
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const contract = await this.getContractClient();
    const result = await contract.query_price_feed_unsafe("0x" + feedId);
    if (result.Ok !== undefined) {
      return {
        price: convertPrice(result.Ok.price),
        emaPrice: convertPrice(result.Ok.ema_price),
      };
    } else {
      throw new Error(JSON.stringify(result.Err));
    }
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const provider = this.chain.getProvider();
    const contract = await this.getContractClient();
    const account = new Account(
      provider,
      "0x" + senderAddress,
      "0x" + senderPrivateKey,
    );
    contract.connect(account);

    const feeToken = "0x" + (await this.getFeeTokenAddresses())[0];
    const tokenClassData = await provider.getClassAt(feeToken);
    const tokenContract = new Contract(tokenClassData.abi, feeToken, provider);
    tokenContract.connect(account);

    const ids = [];
    const infos = [];
    for (const vaa of vaas) {
      const updateData = ByteBuffer.fromBuffer(vaa);
      const feeAmount = await contract.get_update_fee(updateData, feeToken);
      const feeTx = await tokenContract.approve(this.address, feeAmount);
      await provider.waitForTransaction(feeTx.transaction_hash);

      const tx = await contract.update_price_feeds(updateData);
      const info = await provider.waitForTransaction(tx.transaction_hash);
      ids.push(tx.transaction_hash);
      infos.push(info);
    }
    return { id: ids.join(","), info: infos };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const senderAddress = await this.chain.getAccountAddress(senderPrivateKey);
    const provider = this.chain.getProvider();
    const contract = await this.getContractClient();
    const account = new Account(
      provider,
      "0x" + senderAddress,
      "0x" + senderPrivateKey,
    );
    contract.connect(account);

    const updateData = ByteBuffer.fromBuffer(vaa);
    const tx = await contract.execute_governance_instruction(updateData);
    const info = await provider.waitForTransaction(tx.transaction_hash);
    return { id: tx.transaction_hash, info };
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const contract = await this.getContractClient();
    const source: { emitter_chain_id: bigint; emitter_address: bigint } =
      await contract.governance_data_source();
    return {
      emitterChain: Number(source.emitter_chain_id),
      emitterAddress: source.emitter_address.toString(16).padStart(64, "0"),
    };
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return StarknetPriceFeedContract.type;
  }
}

function convertPrice(obj: {
  price: bigint;
  conf: bigint;
  expo: bigint;
  publish_time: bigint;
}): Price {
  return {
    price: obj.price.toString(),
    conf: obj.conf.toString(),
    expo: obj.expo.toString(),
    publishTime: obj.publish_time.toString(),
  };
}

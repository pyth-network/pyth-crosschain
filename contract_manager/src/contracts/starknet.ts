import { DataSource } from "@pythnetwork/xc-admin-common";
import {
  KeyValueConfig,
  PriceFeed,
  PriceFeedContract,
  PrivateKey,
  TxResult,
} from "../base";
import { Chain, StarknetChain } from "../chains";
import { Contract } from "starknet";

export class StarknetPriceFeedContract extends PriceFeedContract {
  static type = "StarknetPriceFeedContract";

  constructor(public chain: StarknetChain, public address: string) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    }
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
        emitterAddress: source.emitter_address.toString(16),
      };
    });
  }

  getBaseUpdateFee(): Promise<{ amount: string; denom?: string | undefined }> {
    throw new Error("Method not implemented.");
  }
  getLastExecutedGovernanceSequence(): Promise<number> {
    throw new Error("Method not implemented.");
  }
  getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    throw new Error("Method not implemented.");
  }
  executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[]
  ): Promise<TxResult> {
    throw new Error("Method not implemented.");
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
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return StarknetPriceFeedContract.type;
  }
}

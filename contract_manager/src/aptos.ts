import { Contract } from "./base";
import { AptosChain, Chains } from "./chains";
import { DataSource, HexString32Bytes } from "@pythnetwork/xc-governance-sdk";
import { AptosClient } from "aptos";

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

  static fromJson(parsed: any): AptosContract {
    if (parsed.type !== AptosContract.type) throw new Error("Invalid type");
    if (!Chains[parsed.chain])
      throw new Error(`Chain ${parsed.chain} not found`);
    return new AptosContract(
      Chains[parsed.chain] as AptosChain,
      parsed.stateId,
      parsed.wormholeStateId
    );
  }

  executeGovernanceInstruction(sender: any, vaa: Buffer): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getClient(): AptosClient {
    return new AptosClient(this.chain.rpcUrl);
  }

  getStateResources() {
    const client = this.getClient();
    return client.getAccountResources(this.stateId);
  }

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
    return { amount: data.fee, denom: "uAPT" };
  }

  getChain(): AptosChain {
    return this.chain;
  }

  async getDataSources(): Promise<DataSource[]> {
    const data = (await this.findResource("DataSources")) as any;
    return data.sources.keys.map((source: any) => {
      return new DataSource(
        Number(source.emitter_chain),
        new HexString32Bytes(source.emitter_address.external_address)
      );
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const data = (await this.findResource("GovernanceDataSource")) as any;
    return new DataSource(
      Number(data.source.emitter_chain),
      new HexString32Bytes(data.source.emitter_address.external_address)
    );
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return AptosContract.type;
  }

  async getValidTimePeriod() {
    const data = (await this.findResource("StalePriceThreshold")) as any;
    return Number(data.threshold_secs);
  }

  toJson() {
    return {
      chain: this.chain.id,
      stateId: this.stateId,
      wormholeStateId: this.wormholeStateId,
      type: AptosContract.type,
    };
  }
}

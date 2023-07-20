import { Contract } from "./base";
import { AptosChain, Chain } from "./chains";
import { DataSource } from "xc_admin_common";

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

  executeGovernanceInstruction(
    senderPrivateKey: string,
    vaa: Buffer
  ): Promise<any> {
    throw new Error("Method not implemented.");
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

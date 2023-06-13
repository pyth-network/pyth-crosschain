import { ethers } from "ethers";
import { Contract, ContractType, NetworkId, SyncOp } from "./Contract";

export class EvmWormholeReceiver implements Contract<EvmWormholeReceiverState> {
  public type = ContractType.EvmWormholeReceiver;
  public networkId;
  private address;

  private contract: ethers.Contract;

  constructor(
    networkId: NetworkId,
    address: string,
    contract: ethers.Contract
  ) {
    this.networkId = networkId;
    this.address = address;
    this.contract = contract;
  }

  public getAddress() {
    return this.address;
  }

  public async getState(): Promise<EvmWormholeReceiverState> {
    const bytecodeSha = ethers.sha256(
      (await this.contract.getDeployedCode()) as string
    );

    return {
      bytecodeSha,
    };
  }

  public async sync(target: EvmWormholeReceiverState): Promise<SyncOp[]> {
    // TODO
    return [];
  }
}

export interface EvmWormholeReceiverState {
  bytecodeSha: string;
}

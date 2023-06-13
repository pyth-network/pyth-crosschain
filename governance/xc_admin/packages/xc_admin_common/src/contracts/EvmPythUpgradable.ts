import {
  Contract,
  ContractType,
  NetworkId,
  SendGovernanceInstruction,
  SyncOp,
  WormholeAddress,
  WormholeNetwork,
} from "./Contract";
import {
  ChainId,
  SetValidPeriodInstruction,
} from "@pythnetwork/xc-governance-sdk";
import { ethers } from "ethers";

export class EvmPythUpgradable implements Contract<EvmPythUpgradableState> {
  public type = ContractType.EvmPythUpgradable;
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

  // ??? do we want this?
  public async getValidTimePeriod(): Promise<bigint> {
    return await this.contract.getValidTimePeriod();
  }

  public async getAuthority(): Promise<WormholeAddress> {
    // FIXME: read from data sources
    return {
      emitter: "123454",
      chainId: 1,
      network: "mainnet",
    };
  }

  // get the chainId that identifies this contract
  public async getChainId(): Promise<ChainId> {
    // FIXME: read from data sources
    return 23;
  }

  public async getState(): Promise<EvmPythUpgradableState> {
    const bytecodeSha = ethers.utils.sha256(
      (await this.contract.provider.getCode(this.contract.address)) as string
    );
    const validTimePeriod = (await this.getValidTimePeriod()) as bigint;
    // TODO: add more state info here -- this will need the full PythUpgradable ABI
    return {
      bytecodeSha,
      validTimePeriod: validTimePeriod.toString(10),
    };
  }

  public async sync(target: EvmPythUpgradableState): Promise<SyncOp[]> {
    const myState = await this.getState();
    const authority = await this.getAuthority();
    const myChainId = await this.getChainId();
    const whInstructions = [];

    if (myState.validTimePeriod !== target.validTimePeriod) {
      whInstructions.push(
        new SetValidPeriodInstruction(myChainId, BigInt(target.validTimePeriod))
      );
    }

    return whInstructions.map(
      (value) =>
        new SendGovernanceInstruction(
          value,
          authority,
          this.submitGovernanceVaa
        )
    );
  }

  public async submitGovernanceVaa(vaa: string): Promise<boolean> {
    // FIXME
    // await this.contract.executeGovernanceInstruction("0x" + vaa)
    return true;
  }
}

export interface EvmPythUpgradableState {
  bytecodeSha: string;
  // bigint serialized as a string
  validTimePeriod: string;
}

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { Storable } from "./base";
import {
  CHAINS,
  CosmwasmUpgradeContractInstruction,
  EthereumUpgradeContractInstruction,
  HexString20Bytes,
  HexString32Bytes,
  SetFeeInstruction,
  SuiAuthorizeUpgradeContractInstruction,
} from "@pythnetwork/xc-governance-sdk";
import { BufferBuilder } from "@pythnetwork/xc-governance-sdk/lib/serialize";

export abstract class Chain extends Storable {
  protected constructor(public id: string) {
    super();
  }

  getId(): string {
    return this.id;
  }

  /**
   * Returns the payload for a governance SetFee instruction for contracts deployed on this chain
   * @param fee the new fee to set
   * @param exponent the new fee exponent to set
   */
  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    return new SetFeeInstruction(
      CHAINS[this.getId() as keyof typeof CHAINS],
      BigInt(fee),
      BigInt(exponent)
    ).serialize();
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param upgradeInfo based on the contract type, this can be a contract address, codeId, package digest, etc.
   */
  abstract generateGovernanceUpgradePayload(upgradeInfo: any): Buffer;
}

export class CosmWasmChain extends Chain {
  static type: string = "CosmWasmChain";

  constructor(
    id: string,
    public querierEndpoint: string,
    public executorEndpoint: string,
    public gasPrice: string,
    public prefix: string,
    public feeDenom: string
  ) {
    super(id);
  }

  static fromJson(parsed: any): CosmWasmChain {
    if (parsed.type !== CosmWasmChain.type) throw new Error("Invalid type");
    return new CosmWasmChain(
      parsed.id,
      parsed.querierEndpoint,
      parsed.executorEndpoint,
      parsed.gasPrice,
      parsed.prefix,
      parsed.feeDenom
    );
  }

  toJson(): any {
    return {
      querierEndpoint: this.querierEndpoint,
      executorEndpoint: this.executorEndpoint,
      id: this.id,
      gasPrice: this.gasPrice,
      prefix: this.prefix,
      feeDenom: this.feeDenom,
      type: CosmWasmChain.type,
    };
  }

  getType(): string {
    return CosmWasmChain.type;
  }

  generateGovernanceUpgradePayload(codeId: bigint): Buffer {
    return new CosmwasmUpgradeContractInstruction(
      CHAINS[this.getId() as keyof typeof CHAINS],
      codeId
    ).serialize();
  }
}

export class SuiChain extends Chain {
  static type: string = "SuiChain";

  constructor(id: string, public rpcUrl: string) {
    super(id);
  }

  static fromJson(parsed: any): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(parsed.id, parsed.rpcUrl);
  }

  toJson(): any {
    return {
      id: this.id,
      rpcUrl: this.rpcUrl,
      type: SuiChain.type,
    };
  }

  getType(): string {
    return SuiChain.type;
  }

  private wrapWithWormholeGovernancePayload(
    actionVariant: number,
    payload: Buffer
  ): Buffer {
    const builder = new BufferBuilder();
    builder.addBuffer(
      Buffer.from(
        "0000000000000000000000000000000000000000000000000000000000000001",
        "hex"
      )
    );
    builder.addUint8(actionVariant);
    builder.addUint16(CHAINS["sui"]); // should always be sui (21) no matter devnet or testnet
    builder.addBuffer(payload);
    return builder.build();
  }

  generateGovernanceUpgradePayload(digest: string): Buffer {
    let setFee = new SuiAuthorizeUpgradeContractInstruction(
      CHAINS["sui"],
      new HexString32Bytes(digest)
    ).serialize();
    return this.wrapWithWormholeGovernancePayload(0, setFee);
  }

  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    let setFee = new SetFeeInstruction(
      CHAINS["sui"],
      BigInt(fee),
      BigInt(exponent)
    ).serialize();
    return this.wrapWithWormholeGovernancePayload(3, setFee);
  }
}

export class EVMChain extends Chain {
  static type: string = "EVMChain";

  constructor(id: string, public rpcUrl: string) {
    super(id);
  }

  static fromJson(parsed: any): EVMChain {
    if (parsed.type !== EVMChain.type) throw new Error("Invalid type");
    return new EVMChain(parsed.id, parsed.rpcUrl);
  }

  generateGovernanceUpgradePayload(address: HexString20Bytes): Buffer {
    return new EthereumUpgradeContractInstruction(
      CHAINS[this.getId() as keyof typeof CHAINS],
      address
    ).serialize();
  }

  toJson(): any {
    return {
      id: this.id,
      rpcUrl: this.rpcUrl,
      type: EVMChain.type,
    };
  }

  getType(): string {
    return EVMChain.type;
  }
}

export const Chains: Record<string, Chain> = {};

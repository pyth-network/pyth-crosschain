import { Storable } from "./base";
import {
  ChainName,
  CHAINS,
  SetFee,
  CosmosUpgradeContract,
  EvmUpgradeContract,
  SuiAuthorizeUpgradeContract,
  AptosAuthorizeUpgradeContract,
} from "xc_admin_common";
import { AptosClient } from "aptos";

export abstract class Chain extends Storable {
  protected constructor(public id: string, public mainnet: boolean) {
    super();
  }

  getId(): string {
    return this.id;
  }

  isMainnet(): boolean {
    return this.mainnet;
  }

  /**
   * Returns the payload for a governance SetFee instruction for contracts deployed on this chain
   * @param fee the new fee to set
   * @param exponent the new fee exponent to set
   */
  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    return new SetFee(
      this.getId() as ChainName,
      BigInt(fee),
      BigInt(exponent)
    ).encode();
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
    mainnet: boolean,
    public querierEndpoint: string,
    public executorEndpoint: string,
    public gasPrice: string,
    public prefix: string,
    public feeDenom: string
  ) {
    super(id, mainnet);
  }

  static fromJson(parsed: any): CosmWasmChain {
    if (parsed.type !== CosmWasmChain.type) throw new Error("Invalid type");
    return new CosmWasmChain(
      parsed.id,
      parsed.mainnet,
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
      mainnet: this.mainnet,
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
    return new CosmosUpgradeContract(
      this.getId() as ChainName,
      codeId
    ).encode();
  }
}

export class SuiChain extends Chain {
  static type: string = "SuiChain";

  constructor(id: string, mainnet: boolean, public rpcUrl: string) {
    super(id, mainnet);
  }

  static fromJson(parsed: any): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(parsed.id, parsed.mainnet, parsed.rpcUrl);
  }

  toJson(): any {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: SuiChain.type,
    };
  }

  getType(): string {
    return SuiChain.type;
  }

  //TODO: Move this logic to xc_admin_common
  private wrapWithWormholeGovernancePayload(
    actionVariant: number,
    payload: Buffer
  ): Buffer {
    const actionVariantBuffer = Buffer.alloc(1);
    actionVariantBuffer.writeUint8(actionVariant, 0);
    const chainBuffer = Buffer.alloc(2);
    chainBuffer.writeUint16BE(CHAINS["sui"], 0);
    const result = Buffer.concat([
      Buffer.from(
        "0000000000000000000000000000000000000000000000000000000000000001",
        "hex"
      ),
      actionVariantBuffer,
      chainBuffer,
      payload,
    ]);
    return result;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    let setFee = new SuiAuthorizeUpgradeContract("sui", digest).encode();
    return this.wrapWithWormholeGovernancePayload(0, setFee);
  }

  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    let setFee = new SetFee(
      "sui", // should always be sui no matter devnet or testnet or mainnet
      BigInt(fee),
      BigInt(exponent)
    ).encode();
    return this.wrapWithWormholeGovernancePayload(3, setFee);
  }
}

export class EVMChain extends Chain {
  static type: string = "EVMChain";

  constructor(id: string, mainnet: boolean, private rpcUrl: string) {
    super(id, mainnet);
  }

  static fromJson(parsed: any): EVMChain {
    if (parsed.type !== EVMChain.type) throw new Error("Invalid type");
    return new EVMChain(parsed.id, parsed.mainnet, parsed.rpcUrl);
  }

  getRpcUrl(): string {
    if (this.rpcUrl.includes("$INFURA_KEY") && !process.env.INFURA_KEY)
      throw new Error(
        `INFURA_KEY not set in env but present in rpcUrl ${this.rpcUrl}`
      );
    return this.rpcUrl.replace("$INFURA_KEY", process.env.INFURA_KEY || "");
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param address hex string of the 20 byte address of the contract to upgrade to without the 0x prefix
   */
  generateGovernanceUpgradePayload(address: string): Buffer {
    return new EvmUpgradeContract(this.getId() as ChainName, address).encode();
  }

  toJson(): any {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: EVMChain.type,
    };
  }

  getType(): string {
    return EVMChain.type;
  }
}

export class AptosChain extends Chain {
  static type = "AptosChain";

  constructor(id: string, mainnet: boolean, public rpcUrl: string) {
    super(id, mainnet);
  }

  getClient(): AptosClient {
    return new AptosClient(this.rpcUrl);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new AptosAuthorizeUpgradeContract("aptos", digest).encode();
  }

  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    return new SetFee(
      "aptos", // should always be aptos no matter devnet or testnet or mainnet
      BigInt(fee),
      BigInt(exponent)
    ).encode();
  }

  getType(): string {
    return AptosChain.type;
  }

  toJson(): any {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: AptosChain.type,
    };
  }

  static fromJson(parsed: any): AptosChain {
    if (parsed.type !== AptosChain.type) throw new Error("Invalid type");
    return new AptosChain(parsed.id, parsed.mainnet, parsed.rpcUrl);
  }
}

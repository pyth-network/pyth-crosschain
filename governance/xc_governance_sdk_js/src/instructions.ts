import { ChainId } from "./chains";

import { Serializable, BufferBuilder } from "./serialize";

enum Module {
  Executor = 0,
  Target,
}

enum TargetAction {
  UpgradeContract = 0,
  AuthorizeGovernanceDataSourceTransfer,
  SetDataSources,
  SetFee,
  SetValidPeriod,
  RequestGovernanceDataSourceTransfer,
  SetWormholeAddress,
}

abstract class HexString implements Serializable {
  private readonly addressBuffer: Buffer;

  constructor(address: string, byteLen: number) {
    if (address.startsWith("0x")) {
      address = address.substring(2);
    }
    if (address.length !== 2 * byteLen) {
      throw new Error(
        `Expected address of length ${2 * byteLen}, found ${address.length}`
      );
    }
    this.addressBuffer = Buffer.from(address, "hex");
    if (this.addressBuffer.length === 0) {
      throw new Error(`Given address is not in hex format`);
    }
  }

  serialize(): Buffer {
    return this.addressBuffer;
  }
}

export class HexString20Bytes extends HexString {
  constructor(address: string) {
    super(address, 20);
  }
}

export class HexString32Bytes extends HexString {
  constructor(address: string) {
    super(address, 32);
  }
}

export class DataSource implements Serializable {
  constructor(
    private readonly emitterChain: ChainId,
    private readonly emitterAddress: HexString32Bytes
  ) {}

  serialize(): Buffer {
    return new BufferBuilder()
      .addUint16(Number(this.emitterChain))
      .addObject(this.emitterAddress)
      .build();
  }
}

// Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
const MAGIC = 0x5054474d;

export abstract class Instruction implements Serializable {
  constructor(
    private module: Module,
    private action: number,
    private targetChainId: ChainId
  ) {}

  protected abstract serializePayload(): Buffer;

  private serializeHeader(): Buffer {
    return new BufferBuilder()
      .addUint32(MAGIC)
      .addUint8(this.module)
      .addUint8(this.action)
      .addUint16(Number(this.targetChainId))
      .build();
  }

  public serialize(): Buffer {
    return new BufferBuilder()
      .addBuffer(this.serializeHeader())
      .addBuffer(this.serializePayload())
      .build();
  }
}

abstract class TargetInstruction extends Instruction {
  constructor(action: TargetAction, targetChainId: ChainId) {
    super(Module.Target, Number(action), targetChainId);
  }
}

export class AptosAuthorizeUpgradeContractInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private hash: HexString32Bytes) {
    super(TargetAction.UpgradeContract, targetChainId);
  }

  protected serializePayload(): Buffer {
    return this.hash.serialize();
  }
}

export class EthereumUpgradeContractInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private address: HexString20Bytes) {
    super(TargetAction.UpgradeContract, targetChainId);
  }

  protected serializePayload(): Buffer {
    return this.address.serialize();
  }
}

export class CosmwasmUpgradeContractInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private codeId: bigint) {
    super(TargetAction.UpgradeContract, targetChainId);
  }

  protected serializePayload(): Buffer {
    return new BufferBuilder().addBigUint64(this.codeId).build();
  }
}

export class AuthorizeGovernanceDataSourceTransferInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private claimVaa: Buffer) {
    super(TargetAction.AuthorizeGovernanceDataSourceTransfer, targetChainId);
  }

  protected serializePayload(): Buffer {
    return this.claimVaa;
  }
}

export class SetDataSourcesInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private dataSources: DataSource[]) {
    super(TargetAction.SetDataSources, targetChainId);
  }

  protected serializePayload(): Buffer {
    const builder = new BufferBuilder();
    builder.addUint8(this.dataSources.length);
    this.dataSources.forEach((datasource) => builder.addObject(datasource));
    return builder.build();
  }
}

export class SetFeeInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private newFeeValue: bigint,
    private newFeeExpo: bigint
  ) {
    super(TargetAction.SetFee, targetChainId);
  }

  protected serializePayload(): Buffer {
    return new BufferBuilder()
      .addBigUint64(this.newFeeValue)
      .addBigUint64(this.newFeeExpo)
      .build();
  }
}

export class SetValidPeriodInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private newValidPeriod: bigint) {
    super(TargetAction.SetValidPeriod, targetChainId);
  }

  protected serializePayload(): Buffer {
    return new BufferBuilder().addBigUint64(this.newValidPeriod).build();
  }
}

export class RequestGovernanceDataSourceTransferInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private governanceDataSourceIndex: number
  ) {
    super(TargetAction.RequestGovernanceDataSourceTransfer, targetChainId);
  }

  protected serializePayload(): Buffer {
    return new BufferBuilder()
      .addUint32(this.governanceDataSourceIndex)
      .build();
  }
}

export class EthereumSetWormholeAddress extends TargetInstruction {
  constructor(targetChainId: ChainId, private address: HexString20Bytes) {
    super(TargetAction.SetWormholeAddress, targetChainId);
  }

  protected serializePayload(): Buffer {
    return this.address.serialize();
  }
}

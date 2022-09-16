import { ChainId } from "@certusone/wormhole-sdk";

import { SerializeUtils, Serializable } from "./serialize";

enum Module {
  Core = 0,
  Target,
  Attest,
}

enum TargetAction {
  UpgradeContract = 0,
  SetGovernanceDataSource,
  SetDataSources,
  SetFee,
  SetValidPeriod,
}

abstract class HexString implements Serializable {
  private readonly addressBuffer: Buffer;

  constructor(address: string, byteLen: number) {
    if (address.startsWith("0x")) {
      address = address.substring(2);
    }
    if (address.length !== 2 * byteLen) {
      throw new Error(`Expected address of length ${2 * byteLen}, found ${address.length}`);
    }
    this.addressBuffer = Buffer.from(address, "hex");
    if (this.addressBuffer.length === 0) {
      throw new Error(`Given address is not in hex format`);
    }
  }

  serialize(): Uint8Array {
    return Uint8Array.from(this.addressBuffer.values());
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
    private readonly emitterAddress: HexString32Bytes,
    private readonly emitterChain: ChainId,
  ) { };

  serialize(): Uint8Array {
    return SerializeUtils.concat(
      SerializeUtils.serializeUint16(Number(this.emitterChain)),
      this.emitterAddress.serialize()
    );
  }
}

// Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
const MAGIC: number = 0x5054474d;

abstract class Instruction implements Serializable {
  constructor(
    private module: Module,
    private action: number,
    private targetChainId: ChainId,
  ) { };

  protected abstract serializePayload(): Uint8Array;

  private serializeHeader(): Uint8Array {
    return SerializeUtils.concat(
      SerializeUtils.serializeUint32(MAGIC),
      SerializeUtils.serializeUint8(this.module),
      SerializeUtils.serializeUint8(this.action),
      SerializeUtils.serializeUint16(Number(this.targetChainId))
    );
  }

  public serialize(): Uint8Array {
    return SerializeUtils.concat(this.serializeHeader(), this.serializePayload());
  }
}

abstract class TargetInstruction extends Instruction {
  constructor(
    action: TargetAction,
    targetChainId: ChainId
  ) {
    super(Module.Target, Number(action), targetChainId);
  }
}

export class EthereumUpgradeContractInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private address: HexString20Bytes,
  ) {
    super(TargetAction.UpgradeContract, targetChainId);
  }

  protected serializePayload(): Uint8Array {
    return this.address.serialize();
  }
}

export class SetGovernanceDataSourceInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private governanceDataSource: DataSource,
    private initialSequence: bigint,
  ) {
    super(TargetAction.SetGovernanceDataSource, targetChainId);
  }

  protected serializePayload(): Uint8Array {
    return SerializeUtils.concat(
      this.governanceDataSource.serialize(),
      SerializeUtils.serializeBigUint64(this.initialSequence),
    );
  }
}

export class SetDataSourcesInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private dataSources: DataSource[],
  ) {
    super(TargetAction.SetDataSources, targetChainId);
  }

  protected serializePayload(): Uint8Array {
    return SerializeUtils.concat(
      SerializeUtils.serializeUint8(this.dataSources.length),
      ...this.dataSources.map(ds => ds.serialize())
    );
  }
}

export class SetFeeInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private newFeeValue: bigint,
    private newFeeExpo: bigint,
  ) {
    super(TargetAction.SetFee, targetChainId);
  }

  protected serializePayload(): Uint8Array {
    return SerializeUtils.concat(
      SerializeUtils.serializeBigUint64(this.newFeeValue),
      SerializeUtils.serializeBigUint64(this.newFeeExpo)
    );
  }
}

export class SetValidPeriodInstruction extends TargetInstruction {
  constructor(
    targetChainId: ChainId,
    private newValidPeriod: bigint,
  ) {
    super(TargetAction.SetFee, targetChainId);
  }

  protected serializePayload(): Uint8Array {
    return SerializeUtils.serializeBigUint64(this.newValidPeriod);
  }
}

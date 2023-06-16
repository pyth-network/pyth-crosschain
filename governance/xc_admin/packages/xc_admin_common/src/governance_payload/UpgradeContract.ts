import {
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class CosmosUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ codeId: bigint }>> =
    BufferLayout.struct([BufferLayoutExt.u64be()]);

  constructor(header: PythGovernanceHeader, readonly codeId: bigint) {
    super(header);
    this.codeId = codeId;
  }

  static decode(data: Buffer): CosmosUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new CosmosUpgradeContract(decoded[0], decoded[1].codeId);
  }

  /** Encode CosmosUpgradeContract */
  encode(): Buffer {
    return super.encodeWithPayload(CosmosUpgradeContract.layout, {
      codeId: this.codeId,
    });
  }
}

export class AptosAuthorizeUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ hash: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(32)]);

  constructor(header: PythGovernanceHeader, readonly hash: string) {
    super(header);
  }

  static decode(data: Buffer): AptosAuthorizeUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new AptosAuthorizeUpgradeContract(decoded[0], decoded[1].hash);
  }

  encode(): Buffer {
    return super.encodeWithPayload(AptosAuthorizeUpgradeContract.layout, {
      hash: this.hash,
    });
  }
}

export class EthereumUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ address: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(20)]);

  constructor(header: PythGovernanceHeader, readonly address: string) {
    super(header);
  }

  static decode(data: Buffer): EthereumUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new EthereumUpgradeContract(decoded[0], decoded[1].address);
  }

  encode(): Buffer {
    return super.encodeWithPayload(EthereumUpgradeContract.layout, {
      address: this.address,
    });
  }
}

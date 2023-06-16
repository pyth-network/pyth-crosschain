import { ChainName } from "@certusone/wormhole-sdk";
import {
  PythGovernanceAction,
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from ".";
import {
  HexString20Bytes,
  HexString32Bytes,
} from "@pythnetwork/xc-governance-sdk";
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
  static layout: BufferLayout.Structure<Readonly<{ hash: HexString32Bytes }>> =
    BufferLayout.struct([BufferLayoutExt.hex32()]);

  constructor(header: PythGovernanceHeader, readonly hash: HexString32Bytes) {
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
  static layout: BufferLayout.Structure<
    Readonly<{ address: HexString20Bytes }>
  > = BufferLayout.struct([BufferLayoutExt.hex20()]);

  constructor(
    header: PythGovernanceHeader,
    readonly address: HexString20Bytes
  ) {
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

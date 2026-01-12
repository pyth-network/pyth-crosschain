import type { ChainName } from "../chains";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

// Used by Sui
export class UpgradeLazerContract256Bit extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ hash: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(32, "hash")]);

  constructor(
    targetChainId: ChainName,
    readonly hash: string,
  ) {
    super(targetChainId, "UpgradeLazerContract");
  }

  static decode(data: Buffer): UpgradeLazerContract256Bit | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeLazerContract",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpgradeLazerContract256Bit(
      decoded[0].targetChainId,
      decoded[1].hash,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeLazerContract256Bit.layout, {
      hash: this.hash,
    });
  }
}

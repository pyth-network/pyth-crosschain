import * as BufferLayout from "@solana/buffer-layout";
import type { ChainName } from "../chains";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";

export class UpgradeSuiLazerContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ version: bigint; hash: string }>
  > = BufferLayout.struct([
    BufferLayoutExt.u64be("version"),
    BufferLayoutExt.hexBytes(32, "hash"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly version: bigint,
    readonly hash: string,
  ) {
    super(targetChainId, "UpgradeSuiLazerContract");
  }

  static decode(data: Buffer): UpgradeSuiLazerContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeSuiLazerContract",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpgradeSuiLazerContract(
      decoded[0].targetChainId,
      decoded[1].version,
      decoded[1].hash,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeSuiLazerContract.layout, {
      hash: this.hash,
      version: this.version,
    });
  }
}

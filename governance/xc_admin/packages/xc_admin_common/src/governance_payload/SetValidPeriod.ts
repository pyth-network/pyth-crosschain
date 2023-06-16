import { PythGovernanceActionImpl, PythGovernanceHeader } from ".";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "@certusone/wormhole-sdk";

export class SetValidPeriod extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ newValidPeriod: bigint }>> =
    BufferLayout.struct([BufferLayoutExt.u64be()]);

  constructor(targetChainId: ChainName, readonly newValidPeriod: bigint) {
    super(targetChainId, "SetValidPeriod");
  }

  static decode(data: Buffer): SetValidPeriod | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetValidPeriod",
      this.layout
    );
    if (!decoded) return undefined;

    return new SetValidPeriod(
      decoded[0].targetChainId,
      decoded[1].newValidPeriod
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(SetValidPeriod.layout, {
      newValidPeriod: this.newValidPeriod,
    });
  }
}

import {
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

/** Set the valid period (the default amount of time in which prices are considered fresh) to the provided value */
export class SetValidPeriod extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ newValidPeriod: bigint }>> =
    BufferLayout.struct([BufferLayoutExt.u64be("newValidPeriod")]);

  constructor(
    targetChainId: ChainName,
    readonly newValidPeriod: bigint,
  ) {
    super(targetChainId, "SetValidPeriod");
  }

  static decode(data: Buffer): SetValidPeriod | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetValidPeriod",
      SetValidPeriod.layout,
    );
    if (!decoded) return undefined;

    return new SetValidPeriod(
      decoded[0].targetChainId,
      decoded[1].newValidPeriod,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(SetValidPeriod.layout, {
      newValidPeriod: this.newValidPeriod,
    });
  }
}

import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "@certusone/wormhole-sdk";

/** Set the fee on the target chain to newFeeValue * 10^newFeeExpo */
export class SetFee extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ newFeeValue: bigint; newFeeExpo: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.u64be("newFeeValue"),
    BufferLayoutExt.u64be("newFeeExpo"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly newFeeValue: bigint,
    readonly newFeeExpo: bigint
  ) {
    super(targetChainId, "SetFee");
  }

  static decode(data: Buffer): SetFee | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetFee",
      SetFee.layout
    );
    if (!decoded) return undefined;

    return new SetFee(
      decoded[0].targetChainId,
      decoded[1].newFeeValue,
      decoded[1].newFeeExpo
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(SetFee.layout, {
      newFeeValue: this.newFeeValue,
      newFeeExpo: this.newFeeExpo,
    });
  }
}

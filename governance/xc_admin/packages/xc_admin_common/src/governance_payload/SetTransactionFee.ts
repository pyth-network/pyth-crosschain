import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

/** Set the transaction fee on the target chain to newFeeValue * 10^newFeeExpo */
export class SetTransactionFee extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ newFeeValue: bigint; newFeeExpo: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.u64be("newFeeValue"),
    BufferLayoutExt.u64be("newFeeExpo"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly newFeeValue: bigint,
    readonly newFeeExpo: bigint,
  ) {
    super(targetChainId, "SetTransactionFee");
  }

  static decode(data: Buffer): SetTransactionFee | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetTransactionFee",
      SetTransactionFee.layout,
    );
    if (!decoded) return undefined;

    return new SetTransactionFee(
      decoded[0].targetChainId,
      decoded[1].newFeeValue,
      decoded[1].newFeeExpo,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(SetTransactionFee.layout, {
      newFeeValue: this.newFeeValue,
      newFeeExpo: this.newFeeExpo,
    });
  }
}

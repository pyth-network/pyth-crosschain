import { PythGovernanceActionImpl, PythGovernanceHeader } from ".";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class SetFee extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ newFeeValue: bigint; newFeeExpo: bigint }>
  > = BufferLayout.struct([BufferLayoutExt.u64be(), BufferLayoutExt.u64be()]);

  constructor(
    header: PythGovernanceHeader,
    readonly newFeeValue: bigint,
    readonly newFeeExpo: bigint
  ) {
    super(header);
  }

  static decode(data: Buffer): SetFee | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetFee",
      this.layout
    );
    if (!decoded) return undefined;

    return new SetFee(
      decoded[0],
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

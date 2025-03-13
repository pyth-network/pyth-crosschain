import {
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

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
    readonly newFeeExpo: bigint,
  ) {
    super(targetChainId, "SetFee");
  }

  static decode(data: Buffer): SetFee | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetFee",
      SetFee.layout,
    );
    if (!decoded) return undefined;

    return new SetFee(
      decoded[0].targetChainId,
      decoded[1].newFeeValue,
      decoded[1].newFeeExpo,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(SetFee.layout, {
      newFeeValue: this.newFeeValue,
      newFeeExpo: this.newFeeExpo,
    });
  }
}

/** Set the fee in the specified token on the target chain to newFeeValue * 10^newFeeExpo.
 * The length and encoding of token is chain-specific:
 * - On Starknet, it's a 256-bit BE integer representing the token account address.
 */
export class SetFeeInToken extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{
      newFeeValue: bigint;
      newFeeExpo: bigint;
      tokenLen: number;
    }>
  > = BufferLayout.struct([
    BufferLayoutExt.u64be("newFeeValue"),
    BufferLayoutExt.u64be("newFeeExpo"),
    BufferLayout.u8("tokenLen"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly newFeeValue: bigint,
    readonly newFeeExpo: bigint,
    readonly token: Buffer,
  ) {
    super(targetChainId, "SetFeeInToken");
  }

  static decode(data: Buffer): SetFeeInToken | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "SetFeeInToken") {
      return undefined;
    }

    let index = PythGovernanceHeader.span;
    const fields = SetFeeInToken.layout.decode(data, index);
    index += SetFeeInToken.layout.span;
    return new SetFeeInToken(
      header.targetChainId,
      fields.newFeeValue,
      fields.newFeeExpo,
      data.subarray(index),
    );
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "SetFeeInToken",
    ).encode();

    const fieldsBuf = Buffer.alloc(SetFeeInToken.layout.span);
    SetFeeInToken.layout.encode(
      {
        newFeeValue: this.newFeeValue,
        newFeeExpo: this.newFeeExpo,
        tokenLen: this.token.length,
      },
      fieldsBuf,
    );

    return Buffer.concat([headerBuffer, fieldsBuf, this.token]);
  }
}

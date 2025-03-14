import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

/** Executes an action from the executor contract via the specified executorAddress, callAddress, value, and calldata */
export class EvmExecute extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{
      executorAddress: string;
      callAddress: string;
      value: bigint;
      calldata: Uint8Array;
    }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(20, "executorAddress"),
    BufferLayoutExt.hexBytes(20, "callAddress"),
    BufferLayoutExt.u256be("value"),
    BufferLayout.blob(new BufferLayout.GreedyCount(), "calldata"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly executorAddress: string,
    readonly callAddress: string,
    readonly value: bigint,
    readonly calldata: Buffer,
  ) {
    super(targetChainId, "Execute");
  }

  static decode(data: Buffer): EvmExecute | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "Execute",
      this.layout,
    );
    if (!decoded) return undefined;

    return new EvmExecute(
      decoded[0].targetChainId,
      decoded[1].executorAddress,
      decoded[1].callAddress,
      decoded[1].value,
      Buffer.from(decoded[1].calldata),
    );
  }

  encode(): Buffer {
    // encodeWithPayload creates a buffer using layout.span but EvmExecute.layout span is -1
    // because the calldata length is unknown. So we create a layout with a known calldata length
    // and use that for encoding
    const layout_with_known_span: BufferLayout.Structure<
      Readonly<{
        executorAddress: string;
        callAddress: string;
        value: bigint;
        calldata: Uint8Array;
      }>
    > = BufferLayout.struct([
      BufferLayoutExt.hexBytes(20, "executorAddress"),
      BufferLayoutExt.hexBytes(20, "callAddress"),
      BufferLayoutExt.u256be("value"),
      BufferLayout.blob(this.calldata.length, "calldata"),
    ]);
    return super.encodeWithPayload(layout_with_known_span, {
      executorAddress: this.executorAddress,
      callAddress: this.callAddress,
      value: this.value,
      calldata: this.calldata,
    });
  }
}

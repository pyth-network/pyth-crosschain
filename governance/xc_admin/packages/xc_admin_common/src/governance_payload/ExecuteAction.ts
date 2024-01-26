import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

/** Executes an action from the executor contract via the specified contractAddress, value, and calldata */
export class EvmExecute extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{
      executorAddress: string;
      callAddress: string;
      calldata: Uint8Array;
    }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(20, "executorAddress"),
    BufferLayoutExt.hexBytes(20, "callAddress"),
    BufferLayout.blob(new BufferLayout.GreedyCount(), "calldata"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly executorAddress: string,
    readonly callAddress: string,
    readonly calldata: Uint8Array
  ) {
    super(targetChainId, "Execute");
  }

  static decode(data: Buffer): EvmExecute | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "Execute",
      this.layout
    );
    if (!decoded) return undefined;

    return new EvmExecute(
      decoded[0].targetChainId,
      decoded[1].executorAddress,
      decoded[1].callAddress,
      decoded[1].calldata
    );
  }

  encode(): Buffer {
    //TODO: create the layout based on the calldata length
    return super.encodeWithPayload(EvmExecute.layout, {
      executorAddress: this.executorAddress,
      callAddress: this.callAddress,
      calldata: this.calldata,
    });
  }
}

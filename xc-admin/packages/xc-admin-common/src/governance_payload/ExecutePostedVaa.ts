import { ChainId } from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { ActionId, governanceHeaderLayout } from ".";

export const executePostedVaaLayout: BufferLayout.Structure<ExecutePostedVaaArgs> =
  BufferLayout.struct([
    governanceHeaderLayout(),
    BufferLayout.u32("length"),
    BufferLayout.seq(BufferLayout.u8(), this.length, "instructions"),
  ]);

export type ExecutePostedVaaArgs = {
  header: Readonly<{
    magicNumber: number;
    module: number;
    action: ActionId;
    chain: ChainId;
  }>;
  length: number;
  instructions: number[];
};

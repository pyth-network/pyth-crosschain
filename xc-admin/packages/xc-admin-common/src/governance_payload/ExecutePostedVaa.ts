import { ChainId } from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import {
  ActionId,
  governanceHeaderLayout,
  PythGovernanceHeader,
  verifyHeader,
} from ".";
import { Layout } from "@solana/buffer-layout";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

class Vector<T> extends Layout<T[]> {
  private element: Layout<T>;

  constructor(element: Layout<T>, property?: string) {
    super(-1, property);
    this.element = element;
  }

  decode(b: Uint8Array, offset?: number | undefined): T[] {
    const length = BufferLayout.u32().decode(b, offset);
    return BufferLayout.seq(this.element, length).decode(b, (offset || 0) + 4);
  }
  encode(src: T[], b: Uint8Array, offset?: number | undefined): number {
    return BufferLayout.struct<Readonly<{ lenght: number; src: T[] }>>([
      BufferLayout.u32("length"),
      BufferLayout.seq(this.element, src.length, "elements"),
    ]).encode({ lenght: src.length, src }, b, offset);
  }

  getSpan(b: Buffer, offset?: number): number {
    const length = BufferLayout.u32().decode(b, offset);
    return 4 + this.element.span * length;
  }
}

export type InstructionData = {
  programId: Uint8Array;
  accounts: AccountMetaData[];
  data: number[];
};

export type AccountMetaData = {
  pubkey: Uint8Array;
  isSigner: number;
  isWritable: number;
};

export const accountMetaLayout = BufferLayout.struct<AccountMetaData>([
  BufferLayout.blob(32, "pubkey"),
  BufferLayout.u8("isSigner"),
  BufferLayout.u8("isWritable"),
]);
export const instructionDataLayout = BufferLayout.struct<InstructionData>([
  BufferLayout.blob(32, "programId"),
  new Vector<AccountMetaData>(accountMetaLayout, "accounts"),
  new Vector<number>(BufferLayout.u8(), "data"),
]);

export const executePostedVaaLayout: BufferLayout.Structure<
  Readonly<{
    header: Readonly<{
      magicNumber: number;
      module: number;
      action: ActionId;
      chain: ChainId;
    }>;
    instructions: InstructionData[];
  }>
> = BufferLayout.struct([
  governanceHeaderLayout(),
  new Vector<InstructionData>(instructionDataLayout, "instructions"),
]);

export type ExecutePostedVaaArgs = {
  header: PythGovernanceHeader;
  instructions: TransactionInstruction[];
};

/** Decode ExecutePostedVaaArgs and return undefined if it failed */
export function decodeExecutePostedVaa(
  data: Buffer
): ExecutePostedVaaArgs | undefined {
  let deserialized = executePostedVaaLayout.decode(data);

  let header = verifyHeader(deserialized.header);

  if (!header) {
    return undefined;
  }

  let instructions: TransactionInstruction[] = deserialized.instructions.map(
    (ix) => {
      let programId: PublicKey = new PublicKey(ix.programId);
      let keys: AccountMeta[] = ix.accounts.map((acc) => {
        return {
          pubkey: new PublicKey(acc.pubkey),
          isSigner: Boolean(acc.isSigner),
          isWritable: Boolean(acc.isWritable),
        };
      });
      let data: Buffer = Buffer.from(ix.data);
      return { programId, keys, data };
    }
  );

  return { header, instructions };
}

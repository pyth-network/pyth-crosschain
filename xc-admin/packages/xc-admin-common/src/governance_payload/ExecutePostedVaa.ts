import { ChainId, ChainName } from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { encodeHeader, governanceHeaderLayout, verifyHeader } from ".";
import { Layout } from "@solana/buffer-layout";
import {
  AccountMeta,
  PACKET_DATA_SIZE,
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
    return BufferLayout.struct<Readonly<{ length: number; elements: T[] }>>([
      BufferLayout.u32("length"),
      BufferLayout.seq(this.element, src.length, "elements"),
    ]).encode({ length: src.length, elements: src }, b, offset);
  }

  getSpan(b: Buffer, offset?: number): number {
    const length = BufferLayout.u32().decode(b, offset);
    return 4 + this.element.span * length;
  }
}

export type InstructionData = {
  programId: Uint8Array;
  accounts: AccountMetadata[];
  data: number[];
};

export type AccountMetadata = {
  pubkey: Uint8Array;
  isSigner: number;
  isWritable: number;
};

export const accountMetaLayout = BufferLayout.struct<AccountMetadata>([
  BufferLayout.blob(32, "pubkey"),
  BufferLayout.u8("isSigner"),
  BufferLayout.u8("isWritable"),
]);
export const instructionDataLayout = BufferLayout.struct<InstructionData>([
  BufferLayout.blob(32, "programId"),
  new Vector<AccountMetadata>(accountMetaLayout, "accounts"),
  new Vector<number>(BufferLayout.u8(), "data"),
]);

export const executePostedVaaLayout: BufferLayout.Structure<
  Readonly<{
    header: Readonly<{
      magicNumber: number;
      module: number;
      action: number;
      chain: ChainId;
    }>;
    instructions: InstructionData[];
  }>
> = BufferLayout.struct([
  governanceHeaderLayout(),
  new Vector<InstructionData>(instructionDataLayout, "instructions"),
]);

export class ExecutePostedVaa {
  readonly targetChainId: ChainName;
  readonly instructions: TransactionInstruction[];

  constructor(
    targetChainId: ChainName,
    instructions: TransactionInstruction[]
  ) {
    this.targetChainId = targetChainId;
    this.instructions = instructions;
  }

  /** Decode ExecutePostedVaaArgs */
  static decode(data: Buffer): ExecutePostedVaa {
    let deserialized = executePostedVaaLayout.decode(data);

    let header = verifyHeader(deserialized.header);

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
    return new ExecutePostedVaa(header.targetChainId, instructions);
  }

  /** Encode ExecutePostedVaaArgs */
  encode(): Buffer {
    // PACKET_DATA_SIZE is the maximum transaction size of Solana, so our serialized payload will never be bigger than that
    const buffer = Buffer.alloc(PACKET_DATA_SIZE);
    const offset = encodeHeader(
      { action: "ExecutePostedVaa", targetChainId: this.targetChainId },
      buffer
    );
    let instructions: InstructionData[] = this.instructions.map((ix) => {
      let programId = ix.programId.toBytes();
      let accounts: AccountMetadata[] = ix.keys.map((acc) => {
        return {
          pubkey: acc.pubkey.toBytes(),
          isSigner: acc.isSigner ? 1 : 0,
          isWritable: acc.isWritable ? 1 : 0,
        };
      });
      let data = [...ix.data];
      return { programId, accounts, data };
    });

    const span =
      offset +
      new Vector<InstructionData>(instructionDataLayout, "instructions").encode(
        instructions,
        buffer,
        offset
      );
    return buffer.subarray(0, span);
  }
}

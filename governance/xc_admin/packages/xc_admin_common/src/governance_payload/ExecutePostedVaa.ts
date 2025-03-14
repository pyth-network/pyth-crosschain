import { ChainName } from "../chains";
import * as BufferLayout from "@solana/buffer-layout";
import {
  PythGovernanceAction,
  PythGovernanceHeader,
  safeLayoutDecode,
} from ".";
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

export class ExecutePostedVaa implements PythGovernanceAction {
  readonly targetChainId: ChainName;
  readonly instructions: TransactionInstruction[];
  static layout: Vector<InstructionData> = new Vector<InstructionData>(
    instructionDataLayout,
    "instructions",
  );

  constructor(
    targetChainId: ChainName,
    instructions: TransactionInstruction[],
  ) {
    this.targetChainId = targetChainId;
    this.instructions = instructions;
  }

  /** Decode ExecutePostedVaa */
  static decode(data: Buffer): ExecutePostedVaa | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header) return undefined;

    const deserialized = safeLayoutDecode(
      this.layout,
      data.subarray(PythGovernanceHeader.span),
    );
    if (!deserialized) return undefined;

    let instructions: TransactionInstruction[] = deserialized.map((ix) => {
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
    });
    return new ExecutePostedVaa(header.targetChainId, instructions);
  }

  /** Encode ExecutePostedVaa */
  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "ExecutePostedVaa",
    ).encode();

    // The code will crash if the payload is actually bigger than PACKET_DATA_SIZE. But PACKET_DATA_SIZE is the maximum transaction size of Solana, so our serialized payload should never be bigger than this anyway
    const buffer = Buffer.alloc(PACKET_DATA_SIZE);
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

    const span = ExecutePostedVaa.layout.encode(instructions, buffer);
    return Buffer.concat([headerBuffer, buffer.subarray(0, span)]);
  }
}

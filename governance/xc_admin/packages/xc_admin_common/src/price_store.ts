import {
  AccountMeta,
  Connection,
  MAX_SEED_LENGTH,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from "./multisig_transaction";
import { AnchorAccounts } from "./multisig_transaction/anchor";
import { PRICE_FEED_OPS_KEY } from "./multisig";

export const PRICE_STORE_PROGRAM_ID: PublicKey = new PublicKey(
  "3m6sv6HGqEbuyLV84mD7rJn4MAC9LhUa1y1AUNVqcPfr",
);

export type PriceStoreInitializeInstruction = {
  payerKey: PublicKey;
  authorityKey: PublicKey;
};

export type PriceStoreInitializePublisherInstruction = {
  authorityKey: PublicKey;
  publisherKey: PublicKey;
  bufferKey: PublicKey;
};

// No need to support SubmitPrices instruction.
export type PriceStoreInstruction =
  | {
      type: "Initialize";
      data: PriceStoreInitializeInstruction;
    }
  | {
      type: "InitializePublisher";
      data: PriceStoreInitializePublisherInstruction;
    };

enum InstructionId {
  Initialize = 0,
  SubmitPrices = 1,
  InitializePublisher = 2,
}

// Recommended buffer size, enough to hold 5000 prices.
export const PRICE_STORE_BUFFER_SPACE = 100048;

export function findPriceStoreConfigAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("CONFIG")],
    PRICE_STORE_PROGRAM_ID,
  );
}

export function findPriceStorePublisherConfigAddress(
  publisherKey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("PUBLISHER_CONFIG"), publisherKey.toBuffer()],
    PRICE_STORE_PROGRAM_ID,
  );
}

export function createPriceStoreInstruction(
  data: PriceStoreInstruction,
): TransactionInstruction {
  switch (data.type) {
    case "Initialize": {
      const [configKey, configBump] = findPriceStoreConfigAddress();
      const instructionData = Buffer.concat([
        Buffer.from([InstructionId.Initialize, configBump]),
        data.data.authorityKey.toBuffer(),
      ]);

      return new TransactionInstruction({
        keys: [
          {
            pubkey: data.data.payerKey,
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: configKey,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PRICE_STORE_PROGRAM_ID,
        data: instructionData,
      });
    }
    case "InitializePublisher": {
      const [configKey, configBump] = findPriceStoreConfigAddress();
      const [publisherConfigKey, publisherConfigBump] =
        findPriceStorePublisherConfigAddress(data.data.publisherKey);
      const instructionData = Buffer.concat([
        Buffer.from([
          InstructionId.InitializePublisher,
          configBump,
          publisherConfigBump,
        ]),
        data.data.publisherKey.toBuffer(),
      ]);
      return new TransactionInstruction({
        keys: [
          {
            pubkey: data.data.authorityKey,
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: configKey,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: publisherConfigKey,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: data.data.bufferKey,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PRICE_STORE_PROGRAM_ID,
        data: instructionData,
      });
    }
    default: {
      // No need to support SubmitPrices instruction.
      throw new Error("invalid type");
    }
  }
}

export function parsePriceStoreInstruction(
  instruction: TransactionInstruction,
): PriceStoreInstruction {
  if (!instruction.programId.equals(PRICE_STORE_PROGRAM_ID)) {
    throw new Error("program ID mismatch");
  }
  if (instruction.data.length < 1) {
    throw new Error("instruction data is too short");
  }
  const instructionId = instruction.data.readInt8(0);
  let data: PriceStoreInstruction;
  switch (instructionId) {
    case InstructionId.Initialize: {
      if (instruction.data.length < 34) {
        throw new Error("instruction data is too short");
      }
      const authorityKey = new PublicKey(instruction.data.subarray(2, 34));
      if (instruction.keys.length != 3) {
        throw new Error("invalid number of accounts");
      }
      data = {
        type: "Initialize",
        data: {
          payerKey: instruction.keys[0].pubkey,
          authorityKey,
        },
      };
      break;
    }
    case InstructionId.InitializePublisher: {
      if (instruction.data.length < 35) {
        throw new Error("instruction data is too short");
      }
      const publisherKey = new PublicKey(instruction.data.subarray(3, 35));
      if (instruction.keys.length != 5) {
        throw new Error("invalid number of accounts");
      }
      data = {
        type: "InitializePublisher",
        data: {
          authorityKey: instruction.keys[0].pubkey,
          bufferKey: instruction.keys[3].pubkey,
          publisherKey,
        },
      };
      break;
    }
    case InstructionId.SubmitPrices: {
      throw new Error("SubmitPrices instruction is not supported");
    }
    default: {
      throw new Error("unrecognized instruction id");
    }
  }

  const expected = createPriceStoreInstruction(data);

  if (!expected.data.equals(instruction.data)) {
    const expectedJson = JSON.stringify(expected.data);
    const actualJson = JSON.stringify(instruction.data);
    throw new Error(
      `invalid instruction data: expected ${expectedJson}, got ${actualJson}`,
    );
  }

  const accountEquals = (a: AccountMeta, b: AccountMeta) =>
    a.isSigner == b.isSigner &&
    a.isWritable == b.isWritable &&
    a.pubkey.equals(b.pubkey);

  const accountMismatch = expected.keys.some(
    (ex, index) => !accountEquals(ex, instruction.keys[index]),
  );
  if (accountMismatch) {
    const expectedJson = JSON.stringify(expected.keys);
    const actualJson = JSON.stringify(instruction.keys);
    throw new Error(
      `invalid accounts: expected ${expectedJson}, got ${actualJson}`,
    );
  }
  return data;
}

export class PriceStoreMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.PythPriceStore;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    name: string,
    args: { [key: string]: any },
    accounts: AnchorAccounts,
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction,
  ): PriceStoreMultisigInstruction {
    let result;
    try {
      result = parsePriceStoreInstruction(instruction);
    } catch (e) {
      return new PriceStoreMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data, error: (e as Error).toString() },
        { named: {}, remaining: instruction.keys },
      );
    }

    return new PriceStoreMultisigInstruction(result.type, result.data, {
      named: {},
      remaining: instruction.keys,
    });
  }
}

export async function findDetermisticPublisherBufferAddress(
  publisher: PublicKey,
): Promise<[PublicKey, string]> {
  const seedPrefix = "Buffer";
  const seed =
    seedPrefix +
    publisher.toBase58().substring(0, MAX_SEED_LENGTH - seedPrefix.length);
  const address: PublicKey = await PublicKey.createWithSeed(
    PRICE_FEED_OPS_KEY,
    seed,
    PRICE_STORE_PROGRAM_ID,
  );
  return [address, seed];
}

export async function createDeterministicPublisherBufferAccountInstruction(
  connection: Connection,
  base: PublicKey,
  publisher: PublicKey,
): Promise<TransactionInstruction> {
  const [bufferKey, seed] =
    await findDetermisticPublisherBufferAddress(publisher);
  return SystemProgram.createAccountWithSeed({
    fromPubkey: base,
    basePubkey: base,
    newAccountPubkey: bufferKey,
    seed,
    space: PRICE_STORE_BUFFER_SPACE,
    lamports: await connection.getMinimumBalanceForRentExemption(
      PRICE_STORE_BUFFER_SPACE,
    ),
    programId: PRICE_STORE_PROGRAM_ID,
  });
}

export async function createDetermisticPriceStoreInitializePublisherInstruction(
  authorityKey: PublicKey,
  publisherKey: PublicKey,
): Promise<TransactionInstruction> {
  const bufferKey = (
    await findDetermisticPublisherBufferAddress(publisherKey)
  )[0];
  return createPriceStoreInstruction({
    type: "InitializePublisher",
    data: {
      authorityKey,
      bufferKey,
      publisherKey,
    },
  });
}

export async function isPriceStorePublisherInitialized(
  connection: Connection,
  publisherKey: PublicKey,
): Promise<boolean> {
  const publisherConfigKey =
    findPriceStorePublisherConfigAddress(publisherKey)[0];
  const response = await connection.getAccountInfo(publisherConfigKey);
  return response !== null;
}

export async function isPriceStoreInitialized(
  connection: Connection,
): Promise<boolean> {
  const configKey = findPriceStoreConfigAddress()[0];
  const response = await connection.getAccountInfo(configKey);
  return response !== null;
}

import crypto from "crypto";
// @ts-expect-error
globalThis.crypto = crypto;

import { AnchorProvider, Wallet, Program, Idl } from "@coral-xyz/anchor";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  AnchorMultisigInstruction,
  MESSAGE_BUFFER_PROGRAM_ID,
  MultisigInstructionProgram,
  MultisigParser,
} from "..";
import messageBuffer from "message_buffer/idl/message_buffer.json";
import { MessageBuffer } from "message_buffer/idl/message_buffer";

test("Message buffer multisig instruction parse: create buffer", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "pythtest-crosschain";

  const messageBufferProgram = new Program(
    messageBuffer as Idl,
    new PublicKey(MESSAGE_BUFFER_PROGRAM_ID),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  ) as unknown as Program<MessageBuffer>;

  const parser = MultisigParser.fromCluster(cluster);

  const allowedProgramAuth = PublicKey.unique();
  const baseAccountKey = PublicKey.unique();

  messageBufferProgram.methods
    .createBuffer(allowedProgramAuth, baseAccountKey, 100)
    .accounts({
      admin: PublicKey.unique(),
      payer: PublicKey.unique(),
    })
    .remainingAccounts([
      {
        pubkey: PublicKey.unique(),
        isSigner: false,
        isWritable: true,
      },
    ])
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);

      if (parsedInstruction instanceof AnchorMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.MessageBuffer,
        );
        expect(parsedInstruction.name).toBe("createBuffer");

        expect(
          parsedInstruction.accounts.named["whitelist"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["whitelist"].isSigner).toBe(
          instruction.keys[0].isSigner,
        );
        expect(parsedInstruction.accounts.named["whitelist"].isWritable).toBe(
          instruction.keys[0].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["admin"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["admin"].isSigner).toBe(
          instruction.keys[1].isSigner,
        );
        expect(parsedInstruction.accounts.named["admin"].isWritable).toBe(
          instruction.keys[1].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["payer"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["payer"].isSigner).toBe(
          instruction.keys[2].isSigner,
        );
        expect(parsedInstruction.accounts.named["payer"].isWritable).toBe(
          instruction.keys[2].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["systemProgram"].pubkey.equals(
            instruction.keys[3].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["systemProgram"].isSigner).toBe(
          instruction.keys[3].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["systemProgram"].isWritable,
        ).toBe(instruction.keys[3].isWritable);

        expect(parsedInstruction.accounts.remaining.length).toBe(1);

        expect(
          parsedInstruction.accounts.remaining[0].pubkey.equals(
            instruction.keys[4].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.remaining[0].isSigner).toBe(
          instruction.keys[4].isSigner,
        );
        expect(parsedInstruction.accounts.remaining[0].isWritable).toBe(
          instruction.keys[4].isWritable,
        );

        expect(
          parsedInstruction.args.allowedProgramAuth.equals(allowedProgramAuth),
        ).toBeTruthy();
        expect(
          parsedInstruction.args.baseAccountKey.equals(baseAccountKey),
        ).toBeTruthy();
        expect(parsedInstruction.args.targetSize).toBe(100);

        done();
      } else {
        done("Not instance of MessageBufferMultisigInstruction");
      }
    });
});

test("Message buffer multisig instruction parse: delete buffer", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "pythtest-crosschain";

  const messageBufferProgram = new Program(
    messageBuffer as Idl,
    new PublicKey(MESSAGE_BUFFER_PROGRAM_ID),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  ) as unknown as Program<MessageBuffer>;

  const parser = MultisigParser.fromCluster(cluster);

  const allowedProgramAuth = PublicKey.unique();
  const baseAccountKey = PublicKey.unique();

  messageBufferProgram.methods
    .deleteBuffer(allowedProgramAuth, baseAccountKey)
    .accounts({
      admin: PublicKey.unique(),
      payer: PublicKey.unique(),
      messageBuffer: PublicKey.unique(),
    })
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);

      if (parsedInstruction instanceof AnchorMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.MessageBuffer,
        );
        expect(parsedInstruction.name).toBe("deleteBuffer");

        expect(
          parsedInstruction.accounts.named["whitelist"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["whitelist"].isSigner).toBe(
          instruction.keys[0].isSigner,
        );
        expect(parsedInstruction.accounts.named["whitelist"].isWritable).toBe(
          instruction.keys[0].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["admin"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["admin"].isSigner).toBe(
          instruction.keys[1].isSigner,
        );
        expect(parsedInstruction.accounts.named["admin"].isWritable).toBe(
          instruction.keys[1].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["payer"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["payer"].isSigner).toBe(
          instruction.keys[2].isSigner,
        );
        expect(parsedInstruction.accounts.named["payer"].isWritable).toBe(
          instruction.keys[2].isWritable,
        );

        expect(
          parsedInstruction.accounts.named["messageBuffer"].pubkey.equals(
            instruction.keys[3].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["messageBuffer"].isSigner).toBe(
          instruction.keys[3].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["messageBuffer"].isWritable,
        ).toBe(instruction.keys[3].isWritable);

        expect(parsedInstruction.accounts.remaining.length).toBe(0);

        expect(
          parsedInstruction.args.allowedProgramAuth.equals(allowedProgramAuth),
        ).toBeTruthy();
        expect(
          parsedInstruction.args.baseAccountKey.equals(baseAccountKey),
        ).toBeTruthy();

        done();
      } else {
        done("Not instance of MessageBufferMultisigInstruction");
      }
    });
});

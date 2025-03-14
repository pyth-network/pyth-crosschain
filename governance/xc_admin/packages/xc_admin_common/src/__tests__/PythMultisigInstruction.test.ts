import crypto from "crypto";
// @ts-expect-error
globalThis.crypto = crypto;

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { pythOracleProgram } from "@pythnetwork/client";
import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { MultisigInstructionProgram, MultisigParser } from "..";
import { PythMultisigInstruction } from "../multisig_transaction/PythMultisigInstruction";

test("Pyth multisig instruction parse: create price account", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const pythProgram = pythOracleProgram(
    getPythProgramKeyForCluster(cluster),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );
  const parser = MultisigParser.fromCluster(cluster);

  pythProgram.methods
    .addPrice(-8, 1)
    .accounts({
      fundingAccount: PublicKey.unique(),
      productAccount: PublicKey.unique(),
      priceAccount: PublicKey.unique(),
    })
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);

      if (parsedInstruction instanceof PythMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.PythOracle,
        );
        expect(parsedInstruction.name).toBe("addPrice");
        expect(
          parsedInstruction.accounts.named["fundingAccount"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(
          parsedInstruction.accounts.named["fundingAccount"].isSigner,
        ).toBe(instruction.keys[0].isSigner);
        expect(
          parsedInstruction.accounts.named["fundingAccount"].isWritable,
        ).toBe(instruction.keys[0].isWritable);
        console.log(parsedInstruction.accounts.named["productAccount"]);
        expect(
          parsedInstruction.accounts.named["productAccount"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(
          parsedInstruction.accounts.named["productAccount"].isSigner,
        ).toBe(instruction.keys[1].isSigner);
        expect(
          parsedInstruction.accounts.named["productAccount"].isWritable,
        ).toBe(instruction.keys[1].isWritable);
        expect(
          parsedInstruction.accounts.named["priceAccount"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["priceAccount"].isSigner).toBe(
          instruction.keys[2].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["priceAccount"].isWritable,
        ).toBe(instruction.keys[2].isWritable);
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].pubkey.equals(
            instruction.keys[3].pubkey,
          ),
        ).toBeTruthy();
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].isSigner,
        ).toBe(instruction.keys[3].isSigner);
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].isWritable,
        ).toBe(instruction.keys[3].isWritable);
        expect(parsedInstruction.accounts.remaining.length).toBe(0);

        expect(parsedInstruction.args.expo).toBe(-8);
        expect(parsedInstruction.args.pType).toBe(1);
        done();
      } else {
        done("Not instance of PythMultisigInstruction");
      }
    });
});

test("Pyth multisig instruction parse: set minimum publishers", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const pythProgram = pythOracleProgram(
    getPythProgramKeyForCluster(cluster),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );
  const parser = MultisigParser.fromCluster(cluster);

  pythProgram.methods
    .setMinPub(25, [0, 0, 0])
    .accounts({
      fundingAccount: PublicKey.unique(),
      priceAccount: PublicKey.unique(),
    })
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);

      if (parsedInstruction instanceof PythMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.PythOracle,
        );
        expect(parsedInstruction.name).toBe("setMinPub");
        expect(
          parsedInstruction.accounts.named["fundingAccount"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(
          parsedInstruction.accounts.named["fundingAccount"].isSigner,
        ).toBe(instruction.keys[0].isSigner);
        expect(
          parsedInstruction.accounts.named["fundingAccount"].isWritable,
        ).toBe(instruction.keys[0].isWritable);
        expect(
          parsedInstruction.accounts.named["priceAccount"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["priceAccount"].isSigner).toBe(
          instruction.keys[1].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["priceAccount"].isWritable,
        ).toBe(instruction.keys[1].isWritable);
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].isSigner,
        ).toBe(instruction.keys[2].isSigner);
        expect(
          parsedInstruction.accounts.named["permissionsAccount"].isWritable,
        ).toBe(instruction.keys[2].isWritable);
        expect(parsedInstruction.accounts.remaining.length).toBe(0);
        expect(parsedInstruction.args.minPub).toBe(25);
        done();
      } else {
        done("Not instance of PythMultisigInstruction");
      }
    });
});

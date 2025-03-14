import crypto from "crypto";
// @ts-expect-error
globalThis.crypto = crypto;

import { createWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MultisigInstructionProgram,
  MultisigParser,
  WORMHOLE_ADDRESS,
  ExecutePostedVaa,
} from "..";
import { WormholeMultisigInstruction } from "../multisig_transaction/WormholeMultisigInstruction";

test("Wormhole multisig instruction parse: send message without governance payload", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    WORMHOLE_ADDRESS[cluster]!,
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );
  const parser = MultisigParser.fromCluster(cluster);

  wormholeProgram.methods
    .postMessage(1, Buffer.from([0]), 1)
    .accounts({
      bridge: PublicKey.unique(),
      message: PublicKey.unique(),
      emitter: PublicKey.unique(),
      sequence: PublicKey.unique(),
      feeCollector: PublicKey.unique(),
      clock: PublicKey.unique(),
    })
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);
      if (parsedInstruction instanceof WormholeMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.WormholeBridge,
        );
        expect(parsedInstruction.name).toBe("postMessage");
        expect(
          parsedInstruction.accounts.named["bridge"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["bridge"].isSigner).toBe(
          instruction.keys[0].isSigner,
        );
        expect(parsedInstruction.accounts.named["bridge"].isWritable).toBe(
          instruction.keys[0].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["message"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["message"].isSigner).toBe(
          instruction.keys[1].isSigner,
        );
        expect(parsedInstruction.accounts.named["message"].isWritable).toBe(
          instruction.keys[1].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["emitter"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["emitter"].isSigner).toBe(
          instruction.keys[2].isSigner,
        );
        expect(parsedInstruction.accounts.named["emitter"].isWritable).toBe(
          instruction.keys[2].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["sequence"].pubkey.equals(
            instruction.keys[3].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["sequence"].isSigner).toBe(
          instruction.keys[3].isSigner,
        );
        expect(parsedInstruction.accounts.named["sequence"].isWritable).toBe(
          instruction.keys[3].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["payer"].pubkey.equals(
            instruction.keys[4].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["payer"].isSigner).toBe(
          instruction.keys[4].isSigner,
        );
        expect(parsedInstruction.accounts.named["payer"].isWritable).toBe(
          instruction.keys[4].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["feeCollector"].pubkey.equals(
            instruction.keys[5].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["feeCollector"].isSigner).toBe(
          instruction.keys[5].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["feeCollector"].isWritable,
        ).toBe(instruction.keys[5].isWritable);
        expect(
          parsedInstruction.accounts.named["clock"].pubkey.equals(
            instruction.keys[6].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["clock"].isSigner).toBe(
          instruction.keys[6].isSigner,
        );
        expect(parsedInstruction.accounts.named["clock"].isWritable).toBe(
          instruction.keys[6].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["rent"].pubkey.equals(
            instruction.keys[7].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["rent"].isSigner).toBe(
          instruction.keys[7].isSigner,
        );
        expect(parsedInstruction.accounts.named["rent"].isWritable).toBe(
          instruction.keys[7].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["systemProgram"].pubkey.equals(
            instruction.keys[8].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["systemProgram"].isSigner).toBe(
          instruction.keys[8].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["systemProgram"].isWritable,
        ).toBe(instruction.keys[8].isWritable);
        expect(parsedInstruction.accounts.remaining.length).toBe(0);

        expect(parsedInstruction.args.nonce).toBe(1);
        expect(parsedInstruction.args.payload.equals(Buffer.from([0])));
        expect(parsedInstruction.args.consistencyLevel).toBe(1);
        expect(parsedInstruction.args.targetChain).toBeUndefined();
        done();
      } else {
        done("Not instance of WormholeMultisigInstruction");
      }
    });
});

test("Wormhole multisig instruction parse: send message with governance payload", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    WORMHOLE_ADDRESS[cluster]!,
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );
  const parser = MultisigParser.fromCluster(cluster);

  const executePostedVaa: ExecutePostedVaa = new ExecutePostedVaa("pythnet", [
    SystemProgram.transfer({
      fromPubkey: PublicKey.unique(),
      toPubkey: PublicKey.unique(),
      lamports: 890880,
    }),
  ]);

  wormholeProgram.methods
    .postMessage(0, executePostedVaa.encode(), 0)
    .accounts({
      bridge: PublicKey.unique(),
      message: PublicKey.unique(),
      emitter: PublicKey.unique(),
      sequence: PublicKey.unique(),
      feeCollector: PublicKey.unique(),
      clock: PublicKey.unique(),
    })
    .instruction()
    .then((instruction) => {
      const parsedInstruction = parser.parseInstruction(instruction);
      if (parsedInstruction instanceof WormholeMultisigInstruction) {
        expect(parsedInstruction.program).toBe(
          MultisigInstructionProgram.WormholeBridge,
        );
        expect(parsedInstruction.name).toBe("postMessage");
        expect(
          parsedInstruction.accounts.named["bridge"].pubkey.equals(
            instruction.keys[0].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["bridge"].isSigner).toBe(
          instruction.keys[0].isSigner,
        );
        expect(parsedInstruction.accounts.named["bridge"].isWritable).toBe(
          instruction.keys[0].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["message"].pubkey.equals(
            instruction.keys[1].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["message"].isSigner).toBe(
          instruction.keys[1].isSigner,
        );
        expect(parsedInstruction.accounts.named["message"].isWritable).toBe(
          instruction.keys[1].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["emitter"].pubkey.equals(
            instruction.keys[2].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["emitter"].isSigner).toBe(
          instruction.keys[2].isSigner,
        );
        expect(parsedInstruction.accounts.named["emitter"].isWritable).toBe(
          instruction.keys[2].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["sequence"].pubkey.equals(
            instruction.keys[3].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["sequence"].isSigner).toBe(
          instruction.keys[3].isSigner,
        );
        expect(parsedInstruction.accounts.named["sequence"].isWritable).toBe(
          instruction.keys[3].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["payer"].pubkey.equals(
            instruction.keys[4].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["payer"].isSigner).toBe(
          instruction.keys[4].isSigner,
        );
        expect(parsedInstruction.accounts.named["payer"].isWritable).toBe(
          instruction.keys[4].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["feeCollector"].pubkey.equals(
            instruction.keys[5].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["feeCollector"].isSigner).toBe(
          instruction.keys[5].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["feeCollector"].isWritable,
        ).toBe(instruction.keys[5].isWritable);
        expect(
          parsedInstruction.accounts.named["clock"].pubkey.equals(
            instruction.keys[6].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["clock"].isSigner).toBe(
          instruction.keys[6].isSigner,
        );
        expect(parsedInstruction.accounts.named["clock"].isWritable).toBe(
          instruction.keys[6].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["rent"].pubkey.equals(
            instruction.keys[7].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["rent"].isSigner).toBe(
          instruction.keys[7].isSigner,
        );
        expect(parsedInstruction.accounts.named["rent"].isWritable).toBe(
          instruction.keys[7].isWritable,
        );
        expect(
          parsedInstruction.accounts.named["systemProgram"].pubkey.equals(
            instruction.keys[8].pubkey,
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named["systemProgram"].isSigner).toBe(
          instruction.keys[8].isSigner,
        );
        expect(
          parsedInstruction.accounts.named["systemProgram"].isWritable,
        ).toBe(instruction.keys[8].isWritable);
        expect(parsedInstruction.accounts.remaining.length).toBe(0);

        expect(parsedInstruction.args.nonce).toBe(0);
        expect(
          parsedInstruction.args.payload.equals(executePostedVaa.encode()),
        );
        expect(parsedInstruction.args.consistencyLevel).toBe(0);

        if (parsedInstruction.governanceAction instanceof ExecutePostedVaa) {
          expect(parsedInstruction.governanceAction.targetChainId).toBe(
            "pythnet",
          );

          (
            parsedInstruction.governanceAction
              .instructions as TransactionInstruction[]
          ).forEach((instruction, i) => {
            expect(
              instruction.programId.equals(
                executePostedVaa.instructions[i].programId,
              ),
            );
            expect(
              instruction.data.equals(executePostedVaa.instructions[i].data),
            );
            instruction.keys.forEach((account, j) => {
              expect(
                account.pubkey.equals(
                  executePostedVaa.instructions[i].keys[j].pubkey,
                ),
              ).toBeTruthy();
              expect(account.isSigner).toBe(
                executePostedVaa.instructions[i].keys[j].isSigner,
              );
              expect(account.isWritable).toBe(
                executePostedVaa.instructions[i].keys[j].isWritable,
              );
            });
          });
          done();
        } else {
          done("Not instance of ExecutePostedVaa");
        }
      } else {
        done("Not instance of WormholeMultisigInstruction");
      }
    });
});

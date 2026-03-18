/** biome-ignore-all lint/style/noDoneCallback: test behavior was existing pre-biome */
import crypto from "node:crypto";

// @ts-expect-error
globalThis.crypto = crypto;

import { createWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import type { AccountMeta, TransactionInstruction } from "@solana/web3.js";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ExecutePostedVaa,
  MultisigInstructionProgram,
  MultisigParser,
  WORMHOLE_ADDRESS,
} from "..";
import { WormholeMultisigInstruction } from "../multisig_transaction/WormholeMultisigInstruction";

/**
 * Helper function to safely get an account key from instruction keys array
 */
function getKeyAtIndex(keys: AccountMeta[], index: number): PublicKey {
  const key = keys[index];
  if (!key) {
    throw new Error(`Expected key at index ${index} but found undefined`);
  }
  return key.pubkey;
}

test("Wormhole multisig instruction parse: send message without governance payload", (done) => {
  jest.setTimeout(60_000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    // biome-ignore lint/style/noNonNullAssertion: legacy assertion
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
      clock: PublicKey.unique(),
      emitter: PublicKey.unique(),
      feeCollector: PublicKey.unique(),
      message: PublicKey.unique(),
      sequence: PublicKey.unique(),
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
          parsedInstruction.accounts.named.bridge?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 0),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.bridge?.isSigner).toBe(
          instruction.keys[0]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.bridge?.isWritable).toBe(
          instruction.keys[0]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.message?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 1),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.message?.isSigner).toBe(
          instruction.keys[1]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.message?.isWritable).toBe(
          instruction.keys[1]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.emitter?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 2),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.emitter?.isSigner).toBe(
          instruction.keys[2]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.emitter?.isWritable).toBe(
          instruction.keys[2]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.sequence?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 3),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.sequence?.isSigner).toBe(
          instruction.keys[3]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.sequence?.isWritable).toBe(
          instruction.keys[3]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.payer?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 4),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.payer?.isSigner).toBe(
          instruction.keys[4]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.payer?.isWritable).toBe(
          instruction.keys[4]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.feeCollector?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 5),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.feeCollector?.isSigner).toBe(
          instruction.keys[5]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.feeCollector?.isWritable).toBe(
          instruction.keys[5]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.clock?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 6),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.clock?.isSigner).toBe(
          instruction.keys[6]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.clock?.isWritable).toBe(
          instruction.keys[6]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.rent?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 7),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.rent?.isSigner).toBe(
          instruction.keys[7]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.rent?.isWritable).toBe(
          instruction.keys[7]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.systemProgram?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 8),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.systemProgram?.isSigner).toBe(
          instruction.keys[8]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.systemProgram?.isWritable).toBe(
          instruction.keys[8]?.isWritable,
        );
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
  jest.setTimeout(60_000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    // biome-ignore lint/style/noNonNullAssertion: legacy assertion
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
      lamports: 890_880,
      toPubkey: PublicKey.unique(),
    }),
  ]);

  wormholeProgram.methods
    .postMessage(0, executePostedVaa.encode(), 0)
    .accounts({
      bridge: PublicKey.unique(),
      clock: PublicKey.unique(),
      emitter: PublicKey.unique(),
      feeCollector: PublicKey.unique(),
      message: PublicKey.unique(),
      sequence: PublicKey.unique(),
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
          parsedInstruction.accounts.named.bridge?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 0),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.bridge?.isSigner).toBe(
          instruction.keys[0]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.bridge?.isWritable).toBe(
          instruction.keys[0]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.message?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 1),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.message?.isSigner).toBe(
          instruction.keys[1]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.message?.isWritable).toBe(
          instruction.keys[1]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.emitter?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 2),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.emitter?.isSigner).toBe(
          instruction.keys[2]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.emitter?.isWritable).toBe(
          instruction.keys[2]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.sequence?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 3),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.sequence?.isSigner).toBe(
          instruction.keys[3]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.sequence?.isWritable).toBe(
          instruction.keys[3]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.payer?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 4),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.payer?.isSigner).toBe(
          instruction.keys[4]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.payer?.isWritable).toBe(
          instruction.keys[4]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.feeCollector?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 5),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.feeCollector?.isSigner).toBe(
          instruction.keys[5]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.feeCollector?.isWritable).toBe(
          instruction.keys[5]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.clock?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 6),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.clock?.isSigner).toBe(
          instruction.keys[6]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.clock?.isWritable).toBe(
          instruction.keys[6]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.rent?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 7),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.rent?.isSigner).toBe(
          instruction.keys[7]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.rent?.isWritable).toBe(
          instruction.keys[7]?.isWritable,
        );
        expect(
          parsedInstruction.accounts.named.systemProgram?.pubkey.equals(
            getKeyAtIndex(instruction.keys, 8),
          ),
        ).toBeTruthy();
        expect(parsedInstruction.accounts.named.systemProgram?.isSigner).toBe(
          instruction.keys[8]?.isSigner,
        );
        expect(parsedInstruction.accounts.named.systemProgram?.isWritable).toBe(
          instruction.keys[8]?.isWritable,
        );
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
            const expectedInstruction = executePostedVaa.instructions[i];
            expect(expectedInstruction).toBeDefined();
            if (!expectedInstruction) {
              throw new Error(
                `Expected instruction at index ${i} but found undefined`,
              );
            }

            expect(
              instruction.programId.equals(expectedInstruction.programId),
            ).toBeTruthy();
            expect(
              instruction.data.equals(expectedInstruction.data),
            ).toBeTruthy();
            instruction.keys.forEach((account, j) => {
              const expectedKey = expectedInstruction.keys[j];
              expect(expectedKey).toBeDefined();
              if (!expectedKey) {
                throw new Error(
                  `Expected key at index ${j} but found undefined`,
                );
              }

              expect(account.pubkey.equals(expectedKey.pubkey)).toBeTruthy();
              expect(account.isSigner).toBe(expectedKey.isSigner);
              expect(account.isWritable).toBe(expectedKey.isWritable);
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

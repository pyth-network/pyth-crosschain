import { ChainName } from "@certusone/wormhole-sdk";
import { createWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AnchorProvider, Wallet } from "@project-serum/anchor";
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
import { MultisigParser, WORMHOLE_ADDRESS } from "..";
import {
  encodeExecutePostedVaa,
  ExecutePostedVaaArgs,
} from "../governance_payload/ExecutePostedVaa";
import { WormholeInstruction } from "../multisig_transaction/WormholeInstruction";

test("Multisig instruction parser: send message without governance payload", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    WORMHOLE_ADDRESS[cluster]!,
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions()
    )
  );
  const parser = new MultisigParser(cluster);

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
      expect(parsedInstruction instanceof WormholeInstruction).toBeTruthy();
      expect((parsedInstruction as WormholeInstruction).program).toBe(
        "Wormhole Bridge"
      );
      expect((parsedInstruction as WormholeInstruction).name).toBe(
        "postMessage"
      );
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "bridge"
        ].pubkey.equals(instruction.keys[0].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["bridge"]
          .isSigner
      ).toBe(instruction.keys[0].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["bridge"]
          .isWritable
      ).toBe(instruction.keys[0].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "message"
        ].pubkey.equals(instruction.keys[1].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["message"]
          .isSigner
      ).toBe(instruction.keys[1].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["message"]
          .isWritable
      ).toBe(instruction.keys[1].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "emitter"
        ].pubkey.equals(instruction.keys[2].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["emitter"]
          .isSigner
      ).toBe(instruction.keys[2].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["emitter"]
          .isWritable
      ).toBe(instruction.keys[2].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "sequence"
        ].pubkey.equals(instruction.keys[3].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["sequence"]
          .isSigner
      ).toBe(instruction.keys[3].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["sequence"]
          .isWritable
      ).toBe(instruction.keys[3].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "payer"
        ].pubkey.equals(instruction.keys[4].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["payer"]
          .isSigner
      ).toBe(instruction.keys[4].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["payer"]
          .isWritable
      ).toBe(instruction.keys[4].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].pubkey.equals(instruction.keys[5].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].isSigner
      ).toBe(instruction.keys[5].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].isWritable
      ).toBe(instruction.keys[5].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "clock"
        ].pubkey.equals(instruction.keys[6].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["clock"]
          .isSigner
      ).toBe(instruction.keys[6].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["clock"]
          .isWritable
      ).toBe(instruction.keys[6].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "rent"
        ].pubkey.equals(instruction.keys[7].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["rent"]
          .isSigner
      ).toBe(instruction.keys[7].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["rent"]
          .isWritable
      ).toBe(instruction.keys[7].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].pubkey.equals(instruction.keys[8].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].isSigner
      ).toBe(instruction.keys[8].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].isWritable
      ).toBe(instruction.keys[8].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.remaining.length
      ).toBe(0);

      expect((parsedInstruction as WormholeInstruction).args.nonce).toBe(1);
      expect(
        (parsedInstruction as WormholeInstruction).args.payload.equals(
          Buffer.from([0])
        )
      );
      expect(
        (parsedInstruction as WormholeInstruction).args.consistencyLevel
      ).toBe(1);
      expect(
        (parsedInstruction as WormholeInstruction).args.targetChain
      ).toBeUndefined();

      done();
    });
});

test("Multisig instruction parser: send message with governance payload", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const wormholeProgram = createWormholeProgramInterface(
    WORMHOLE_ADDRESS[cluster]!,
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions()
    )
  );
  const parser = new MultisigParser(cluster);

  const executePostedVaaArgs: ExecutePostedVaaArgs = {
    targetChainId: "pythnet" as ChainName,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: PublicKey.unique(),
        toPubkey: PublicKey.unique(),
        lamports: 890880,
      }),
    ],
  };

  wormholeProgram.methods
    .postMessage(0, encodeExecutePostedVaa(executePostedVaaArgs), 0)
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
      expect(parsedInstruction instanceof WormholeInstruction).toBeTruthy();
      expect((parsedInstruction as WormholeInstruction).program).toBe(
        "Wormhole Bridge"
      );
      expect((parsedInstruction as WormholeInstruction).name).toBe(
        "postMessage"
      );
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "bridge"
        ].pubkey.equals(instruction.keys[0].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["bridge"]
          .isSigner
      ).toBe(instruction.keys[0].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["bridge"]
          .isWritable
      ).toBe(instruction.keys[0].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "message"
        ].pubkey.equals(instruction.keys[1].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["message"]
          .isSigner
      ).toBe(instruction.keys[1].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["message"]
          .isWritable
      ).toBe(instruction.keys[1].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "emitter"
        ].pubkey.equals(instruction.keys[2].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["emitter"]
          .isSigner
      ).toBe(instruction.keys[2].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["emitter"]
          .isWritable
      ).toBe(instruction.keys[2].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "sequence"
        ].pubkey.equals(instruction.keys[3].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["sequence"]
          .isSigner
      ).toBe(instruction.keys[3].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["sequence"]
          .isWritable
      ).toBe(instruction.keys[3].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "payer"
        ].pubkey.equals(instruction.keys[4].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["payer"]
          .isSigner
      ).toBe(instruction.keys[4].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["payer"]
          .isWritable
      ).toBe(instruction.keys[4].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].pubkey.equals(instruction.keys[5].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].isSigner
      ).toBe(instruction.keys[5].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "feeCollector"
        ].isWritable
      ).toBe(instruction.keys[5].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "clock"
        ].pubkey.equals(instruction.keys[6].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["clock"]
          .isSigner
      ).toBe(instruction.keys[6].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["clock"]
          .isWritable
      ).toBe(instruction.keys[6].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "rent"
        ].pubkey.equals(instruction.keys[7].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["rent"]
          .isSigner
      ).toBe(instruction.keys[7].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named["rent"]
          .isWritable
      ).toBe(instruction.keys[7].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].pubkey.equals(instruction.keys[8].pubkey)
      ).toBeTruthy();
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].isSigner
      ).toBe(instruction.keys[8].isSigner);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.named[
          "systemProgram"
        ].isWritable
      ).toBe(instruction.keys[8].isWritable);
      expect(
        (parsedInstruction as WormholeInstruction).accounts.remaining.length
      ).toBe(0);

      expect((parsedInstruction as WormholeInstruction).args.nonce).toBe(0);
      expect(
        (parsedInstruction as WormholeInstruction).args.payload.equals(
          encodeExecutePostedVaa(executePostedVaaArgs)
        )
      );
      expect(
        (parsedInstruction as WormholeInstruction).args.consistencyLevel
      ).toBe(0);

      expect(
        (parsedInstruction as WormholeInstruction).args.governanceName
      ).toBe("ExecutePostedVaa");

      expect(
        (parsedInstruction as WormholeInstruction).args.governanceArgs
          .targetChainId
      ).toBe("pythnet");

      (
        (parsedInstruction as WormholeInstruction).args.governanceArgs
          .instructions as TransactionInstruction[]
      ).forEach((instruction, i) => {
        expect(
          instruction.programId.equals(
            executePostedVaaArgs.instructions[i].programId
          )
        );
        expect(
          instruction.data.equals(executePostedVaaArgs.instructions[i].data)
        );
        instruction.keys.forEach((account, j) => {
          expect(
            account.pubkey.equals(
              executePostedVaaArgs.instructions[i].keys[j].pubkey
            )
          ).toBeTruthy();
          expect(account.isSigner).toBe(
            executePostedVaaArgs.instructions[i].keys[j].isSigner
          );
          expect(account.isWritable).toBe(
            executePostedVaaArgs.instructions[i].keys[j].isWritable
          );
        });
      });

      done();
    });
});

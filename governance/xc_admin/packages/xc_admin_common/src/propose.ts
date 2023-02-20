import Squads, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  PACKET_DATA_SIZE,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  createWormholeProgramInterface,
  deriveWormholeBridgeDataKey,
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { ExecutePostedVaa } from "./governance_payload/ExecutePostedVaa";
import { OPS_KEY } from "./multisig";

type SquadInstruction = {
  instruction: TransactionInstruction;
  authorityIndex?: number;
  authorityBump?: number;
  authorityType?: string;
};

/**
 * Propose an array of `TransactionInstructions` as a proposal
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param instructions instructions that will be proposed
 * @param remote whether the instructions should be executed in the chain of the multisig or remotely on Pythnet
 * @returns the newly created proposal's pubkey
 */
export async function proposeInstructions(
  squad: Squads,
  vault: PublicKey,
  instructions: TransactionInstruction[],
  remote: boolean,
  wormholeAddress?: PublicKey
): Promise<PublicKey> {
  const msAccount = await squad.getMultisig(vault);
  let ixToSend: TransactionInstruction[] = [];
  const createProposal = ixToSend.push(
    await squad.buildCreateTransaction(
      msAccount.publicKey,
      msAccount.authorityIndex,
      msAccount.transactionIndex + 1
    )
  );
  const newProposalAddress = getTxPDA(
    vault,
    new BN(msAccount.transactionIndex + 1),
    squad.multisigProgramId
  )[0];

  if (remote) {
    if (!wormholeAddress) {
      throw new Error("Need wormhole address");
    }
    for (let i = 0; i < instructions.length; i++) {
      const squadIx = await wrapAsRemoteInstruction(
        squad,
        vault,
        newProposalAddress,
        instructions[i],
        i + 1,
        wormholeAddress
      );
      ixToSend.push(
        await squad.buildAddInstruction(
          vault,
          newProposalAddress,
          squadIx.instruction,
          i + 1,
          squadIx.authorityIndex,
          squadIx.authorityBump,
          squadIx.authorityType
        )
      );
    }
  } else {
    for (let i = 0; i < instructions.length; i++) {
      ixToSend.push(
        await squad.buildAddInstruction(
          vault,
          newProposalAddress,
          instructions[i],
          i + 1
        )
      );
    }
  }

  ixToSend.push(
    await squad.buildActivateTransaction(vault, newProposalAddress)
  );

  ixToSend.push(await squad.buildApproveTransaction(vault, newProposalAddress));

  const txToSend = batchIntoTransactions(instructions, squad.wallet.publicKey);
  console.log(txToSend.length);
  console.log(txToSend.map((tx) => getSizeOfTransaction(tx.instructions)));
  await new AnchorProvider(
    squad.connection,
    squad.wallet,
    AnchorProvider.defaultOptions()
  ).sendAndConfirm(txToSend[0]);
  return newProposalAddress;
}

/**
 * Batch instructions into transactions
 */
export function batchIntoTransactions(
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): Transaction[] {
  let i = 0;
  const txToSend: Transaction[] = [];
  while (i < instructions.length) {
    let j = i + 2;
    while (
      j < instructions.length &&
      getSizeOfTransaction(instructions.slice(i, j)) <= PACKET_DATA_SIZE
    ) {
      j += 1;
    }
    const tx = new Transaction();
    tx.feePayer = feePayer;
    for (let k = i; k < j - 1; k += 1) {
      tx.add(instructions[k]);
    }
    i = j - 1;
    txToSend.push(tx);
  }
  return txToSend;
}

/**
 * Get the size of a transaction that would contain the provided array of instructions
 */
export function getSizeOfTransaction(
  instructions: TransactionInstruction[]
): number {
  const signers = new Set<string>();
  const accounts = new Set<string>();

  instructions.map((ix) => {
    accounts.add(ix.programId.toBase58()),
      ix.keys.map((key) => {
        if (key.isSigner) {
          signers.add(key.pubkey.toBase58());
        }
        accounts.add(key.pubkey.toBase58());
      });
  });

  const instruction_sizes: number = instructions
    .map(
      (ix) =>
        1 +
        getSizeOfCompressedU16(ix.keys.length) +
        ix.keys.length +
        getSizeOfCompressedU16(ix.data.length) +
        ix.data.length
    )
    .reduce((a, b) => a + b, 0);
  return (
    1 +
    signers.size * 64 +
    3 +
    getSizeOfCompressedU16(accounts.size) +
    32 * accounts.size +
    32 +
    getSizeOfCompressedU16(instructions.length) +
    instruction_sizes
  );
}

/**
 * Get the size of n in bytes when serialized as a CompressedU16
 */
export function getSizeOfCompressedU16(n: number) {
  return 1 + Number(n >= 128) + Number(n >= 16384);
}

/**
 * Wrap `instruction` in a Wormhole message for remote execution
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param proposalAddress address of the proposal
 * @param instruction instruction to be wrapped in a Wormhole message
 * @param instructionIndex index of the instruction within the proposal
 * @param wormholeAddress address of the Wormhole bridge
 * @returns an instruction to be proposed
 */
export async function wrapAsRemoteInstruction(
  squad: Squads,
  vault: PublicKey,
  proposalAddress: PublicKey,
  instruction: TransactionInstruction,
  instructionIndex: number,
  wormholeAddress: PublicKey
): Promise<SquadInstruction> {
  const emitter = squad.getAuthorityPDA(vault, 1);

  const [messagePDA, messagePdaBump] = getIxAuthorityPDA(
    proposalAddress,
    new BN(instructionIndex),
    squad.multisigProgramId
  );

  const provider = new AnchorProvider(
    squad.connection,
    squad.wallet,
    AnchorProvider.defaultOptions()
  );
  const wormholeProgram = createWormholeProgramInterface(
    wormholeAddress,
    provider
  );

  const buffer: Buffer = new ExecutePostedVaa("pythnet", [
    instruction,
  ]).encode();

  const accounts = getPostMessageAccounts(wormholeAddress, emitter, messagePDA);

  return {
    instruction: await wormholeProgram.methods
      .postMessage(0, buffer, 0)
      .accounts(accounts)
      .instruction(),
    authorityIndex: instructionIndex,
    authorityBump: messagePdaBump,
    authorityType: "custom",
  };
}
function getPostMessageAccounts(
  wormholeAddress: PublicKey,
  emitter: PublicKey,
  message: PublicKey
) {
  return {
    bridge: deriveWormholeBridgeDataKey(wormholeAddress),
    message,
    emitter,
    sequence: deriveEmitterSequenceKey(emitter, wormholeAddress),
    payer: OPS_KEY,
    feeCollector: deriveFeeCollectorKey(wormholeAddress),
    clock: SYSVAR_CLOCK_PUBKEY,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
  };
}

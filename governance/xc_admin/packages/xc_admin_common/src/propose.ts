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
import { getOpsKey, PRICE_FEED_OPS_KEY } from "./multisig";
import {BatchedBuilder, ProposalsBuilder, ProposalIxAuthority} from "./PythAdmin";

export const MAX_EXECUTOR_PAYLOAD_SIZE = PACKET_DATA_SIZE - 687; // Bigger payloads won't fit in one addInstruction call when adding to the proposal
export const SIZE_OF_SIGNED_BATCH = 30;
export const MAX_INSTRUCTIONS_PER_PROPOSAL = 256 - 1;

export async function proposeArbitraryPayload(
  squad: Squads,
  vault: PublicKey,
  payload: Buffer,
  wormholeAddress: PublicKey
): Promise<PublicKey> {
  const builder: ProposalsBuilder = null;
  const proposal = await builder.addProposal();

  proposal.addInstructionWithAuthority(async authority => {
    return await getPostMessageInstruction(
      builder.admin,
      authority,
      wormholeAddress,
      payload
    );
  });

  const ixToSend = await builder.build();
  const txToSend = batchIntoTransactions(ixToSend);

  for (let i = 0; i < txToSend.length; i += SIZE_OF_SIGNED_BATCH) {
    await new AnchorProvider(
      squad.connection,
      squad.wallet,
      AnchorProvider.defaultOptions()
    ).sendAll(
      txToSend.slice(i, i + SIZE_OF_SIGNED_BATCH).map((tx) => {
        return { tx, signers: [] };
      })
    );
  }
  return newProposalAddress;
}

/**
 * Propose an array of `TransactionInstructions` as a proposal
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param instructions instructions that will be proposed
 * @param remote whether the instructions should be executed in the chain of the multisig or remotely on Pythnet
 * @returns the newly created proposal's pubkeyopoer
 */
export async function proposeInstructions(
  squad: Squads,
  vault: PublicKey,
  instructions: TransactionInstruction[],
  remote: boolean,
  wormholeAddress?: PublicKey
): Promise<PublicKey> {
  const builder: BatchedBuilder = null;

  if (remote) {
    if (!wormholeAddress) {
      throw new Error("Need wormhole address");
    }
    const remoteBuilder = new RemoteBuilder(builder, wormholeAddress!);
    for (const instruction of instructions) {
      remoteBuilder.addInstruction(instruction);
    }


  } else {
      for (let [i, instruction] of instructions.entries()) {
        builder.addInstruction(instruction);
      }
    }
  }

  // fixme needs to be remoteBuilder
  const ixToSend = await builder.build();

  const txToSend = batchIntoTransactions(ixToSend);

  for (let i = 0; i < txToSend.length; i += SIZE_OF_SIGNED_BATCH) {
    await new AnchorProvider(squad.connection, squad.wallet, {
      preflightCommitment: "processed",
      commitment: "confirmed",
    }).sendAll(
      txToSend.slice(i, i + SIZE_OF_SIGNED_BATCH).map((tx) => {
        return { tx, signers: [] };
      })
    );
  }
  return newProposals[0];
}

/**
 * Batch instructions into batches for inclusion in a remote executor payload
 */
export function batchIntoExecutorPayload(
  instructions: TransactionInstruction[]
): TransactionInstruction[][] {
  let i = 0;
  const batches: TransactionInstruction[][] = [];
  while (i < instructions.length) {
    let j = i + 2;
    while (
      j < instructions.length &&
      getSizeOfExecutorInstructions(instructions.slice(i, j)) <=
        MAX_EXECUTOR_PAYLOAD_SIZE
    ) {
      j += 1;
    }
    const batch: TransactionInstruction[] = [];
    for (let k = i; k < j - 1; k += 1) {
      batch.push(instructions[k]);
    }
    i = j - 1;
    batches.push(batch);
  }
  return batches;
}

/**
 * Batch instructions into transactions
 */
export function batchIntoTransactions(
  instructions: TransactionInstruction[]
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
    for (let k = i; k < j - 1; k += 1) {
      tx.add(instructions[k]);
    }
    i = j - 1;
    txToSend.push(tx);
  }
  return txToSend;
}

/** Get the size of instructions when serialized as in a remote executor payload */
export function getSizeOfExecutorInstructions(
  instructions: TransactionInstruction[]
) {
  return instructions
    .map((ix) => {
      return 32 + 4 + ix.keys.length * 34 + 4 + ix.data.length;
    })
    .reduce((a, b) => a + b);
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
 * @param instructions instructions to be wrapped in a Wormhole message
 * @param instructionIndex index of the instruction within the proposal
 * @param wormholeAddress address of the Wormhole bridge
 * @returns an instruction to be proposed
 */
export async function wrapAsRemoteInstruction(
  admin: PythAdmin,
  authority: ProposalIxAuthority,
  wormholeAddress: PublicKey,
  instructions: TransactionInstruction[],
): Promise<TransactionInstruction> {
  const buffer: Buffer = new ExecutePostedVaa("pythnet", instructions).encode();

  return await getPostMessageInstruction(
    admin,
    authority,
    wormholeAddress,
    buffer
  );
}

/**
 * Returns a postMessage instruction that will post the provided payload to wormhole when the multisig approves the proposal
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param proposalAddress address of the proposal
 * @param instructionIndex index of the instruction within the proposal
 * @param wormholeAddress address of the Wormhole bridge
 * @param payload the payload to be posted
 */
async function getPostMessageInstruction(
  admin: PythAdmin,
  authority: ProposalIxAuthority,
  wormholeAddress: PublicKey,
  payload: Buffer
): Promise<TransactionInstruction> {
  const emitter = admin.getAuthorityPDA();
  const provider = new AnchorProvider(
    admin.squad.connection,
    admin.squad.wallet,
    AnchorProvider.defaultOptions()
  );
  const wormholeProgram = createWormholeProgramInterface(
    wormholeAddress,
    provider
  );

  const accounts = getPostMessageAccounts(
    wormholeAddress,
    emitter,
    getOpsKey(admin.vault),
    authority.pda
  );

  return await wormholeProgram.methods
      .postMessage(0, payload, 0)
      .accounts(accounts)
      .instruction();
}

function getPostMessageAccounts(
  wormholeAddress: PublicKey,
  emitter: PublicKey,
  payer: PublicKey,
  message: PublicKey
) {
  return {
    bridge: deriveWormholeBridgeDataKey(wormholeAddress),
    message,
    emitter,
    sequence: deriveEmitterSequenceKey(emitter, wormholeAddress),
    payer,
    feeCollector: deriveFeeCollectorKey(wormholeAddress),
    clock: SYSVAR_CLOCK_PUBKEY,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
  };
}

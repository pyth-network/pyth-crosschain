import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  ConfirmOptions,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  createWormholeProgramInterface,
  deriveWormholeBridgeDataKey,
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { ExecutePostedVaa } from "./governance_payload/ExecutePostedVaa";
import { getOpsKey } from "./multisig";
import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import SquadsMesh, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import { MultisigAccount } from "@sqds/mesh/lib/types";
import { mapKey } from "./remote_executor";
import { WORMHOLE_ADDRESS } from "./wormhole";
import {
  TransactionBuilder,
  sendTransactions,
} from "@pythnetwork/solana-utils";
import {
  PACKET_DATA_SIZE_WITH_ROOM_FOR_COMPUTE_BUDGET,
  PriorityFeeConfig,
} from "@pythnetwork/solana-utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

export const MAX_EXECUTOR_PAYLOAD_SIZE =
  PACKET_DATA_SIZE_WITH_ROOM_FOR_COMPUTE_BUDGET - 687; // Bigger payloads won't fit in one addInstruction call when adding to the proposal
export const MAX_INSTRUCTIONS_PER_PROPOSAL = 256 - 1;
export const TIMEOUT = 10;
export const MAX_RETRY_SEND = 70;

type SquadInstruction = {
  instruction: TransactionInstruction;
  authorityIndex?: number;
  authorityBump?: number;
  authorityType?: string;
};

/**
 * A multisig vault can sign arbitrary instructions with various vault-controlled PDAs, if the multisig approves.
 * This of course allows the vault to interact with programs on the same blockchain, but a vault also has two
 * other significant capabilities:
 * 1. It can execute arbitrary transactions on other blockchains that have the Remote Executor program.
 *    This allows e.g., a vault on solana mainnet to control programs deployed on PythNet.
 * 2. It can send wormhole messages from the vault authority. This allows the vault to control programs
 *    on other chains using Pyth governance messages.
 */
export class MultisigVault {
  public wallet: Wallet;
  /// The cluster that this multisig lives on
  public cluster: PythCluster;
  public squad: SquadsMesh;
  public vault: PublicKey;

  constructor(
    wallet: Wallet,
    cluster: PythCluster,
    squad: SquadsMesh,
    vault: PublicKey,
  ) {
    this.wallet = wallet;
    this.cluster = cluster;
    this.squad = squad;
    this.vault = vault;
  }

  public async getMultisigAccount(): Promise<MultisigAccount> {
    return this.squad.getMultisig(this.vault);
  }

  /**
   * Get the PDA that the vault can sign for on `cluster`. If `cluster` is remote, this PDA
   * is the PDA of the remote executor program representing the vault's Wormhole emitter address.
   * @param cluster
   */
  public async getVaultAuthorityPDA(cluster?: PythCluster): Promise<PublicKey> {
    const msAccount = await this.getMultisigAccount();
    const localAuthorityPDA = await this.squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex,
    );

    if (cluster === undefined || cluster === this.cluster) {
      return localAuthorityPDA;
    } else {
      return mapKey(localAuthorityPDA);
    }
  }

  public wormholeAddress(): PublicKey | undefined {
    // TODO: we should configure the wormhole address as a vault parameter.
    return WORMHOLE_ADDRESS[this.cluster];
  }

  // TODO: does this need a cluster argument?
  public async getAuthorityPDA(authorityIndex: number = 1): Promise<PublicKey> {
    return this.squad.getAuthorityPDA(this.vault, authorityIndex);
  }

  // NOTE: this function probably doesn't belong on this class, but it makes it easier to refactor so we'll leave
  // it here for now.
  public getAnchorProvider(opts?: ConfirmOptions): AnchorProvider {
    if (opts === undefined) {
      opts = AnchorProvider.defaultOptions();
    }

    return new AnchorProvider(
      this.squad.connection,
      this.squad.wallet as Wallet,
      opts,
    );
  }

  // Convenience wrappers around squads methods

  public async createProposalIx(
    proposalIndex: number,
  ): Promise<[TransactionInstruction, PublicKey]> {
    const msAccount = await this.squad.getMultisig(this.vault);

    const ix = await this.squad.buildCreateTransaction(
      msAccount.publicKey,
      msAccount.authorityIndex,
      proposalIndex,
    );

    const newProposalAddress = getTxPDA(
      this.vault,
      new BN(proposalIndex),
      this.squad.multisigProgramId,
    )[0];

    return [ix, newProposalAddress];
  }

  public async activateProposalIx(
    proposalAddress: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.squad.buildActivateTransaction(
      this.vault,
      proposalAddress,
    );
  }

  public async approveProposalIx(
    proposalAddress: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.squad.buildApproveTransaction(
      this.vault,
      proposalAddress,
    );
  }

  public async addMemberIx(
    member: PublicKey,
    targetVault: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.squad.buildAddMember(
      targetVault,
      await this.getAuthorityPDA(),
      member,
    );
  }

  public async removeMemberIx(
    member: PublicKey,
    targetVault: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.squad.buildRemoveMember(
      targetVault,
      await this.getAuthorityPDA(),
      member,
    );
  }

  // Propose instructions

  /**
   * Same as proposeWormholeMessageWithPayer, but uses the predefined ops key for the vault
   * If the vault is not configured with an ops key, this will throw an error.
   * @param payload the bytes to send as the wormhole message's payload.
   * @returns the newly created proposal's public key
   */
  public async proposeWormholeMessage(payload: Buffer): Promise<PublicKey> {
    return this.proposeWormholeMessageWithPayer(payload, getOpsKey(this.vault));
  }

  /**
   * Propose submitting `payload` as a wormhole message. If the proposal is approved, the sent message
   * will have `this.getVaultAuthorityPda()` as its emitter address.
   * @param payload the bytes to send as the wormhole message's payload.
   * @param messagePayer key used as the payer for the wormhole message instruction
   * @returns the newly created proposal's public key
   */
  public async proposeWormholeMessageWithPayer(
    payload: Buffer,
    messagePayer: PublicKey,
  ): Promise<PublicKey> {
    return this.proposeWormholeMultipleMessagesWithPayer(
      [payload],
      messagePayer,
    );
  }

  /**
   * Propose submitting `payload` as a wormhole message. If the proposal is approved, the sent message
   * will have `this.getVaultAuthorityPda()` as its emitter address.
   * @param payloads array of the bytes to send as the wormhole message's payload.
   * @param messagePayer key used as the payer for the wormhole message instruction
   * @param proposalAddress the proposal address to use. If not provided, a new proposal will be created. This is useful when because of RPC issues the script can not run until the end successfully.
   * @returns the newly created proposal's public key
   */
  public async proposeWormholeMultipleMessagesWithPayer(
    payloads: Buffer[],
    messagePayer: PublicKey,
    proposalAddress?: PublicKey,
    priorityFeeConfig: PriorityFeeConfig = {},
  ): Promise<PublicKey> {
    const msAccount = await this.getMultisigAccount();

    let ixToSend: TransactionInstruction[] = [];
    let startingIndex = 0;
    if (proposalAddress === undefined) {
      const [proposalIx, newProposalAddress] = await this.createProposalIx(
        msAccount.transactionIndex + 1,
      );
      ixToSend.push(proposalIx);
      proposalAddress = newProposalAddress;
    } else {
      const transaction = await this.squad.getTransaction(proposalAddress);
      startingIndex = transaction.instructionIndex;
    }
    if (payloads.length > MAX_INSTRUCTIONS_PER_PROPOSAL)
      throw new Error(
        "Too many messages in proposal, multiple proposal not supported yet",
      );

    for (let i = startingIndex; i < payloads.length; i++) {
      const instructionToPropose = await getPostMessageInstruction(
        this.squad,
        this.vault,
        proposalAddress,
        1 + i,
        this.wormholeAddress()!,
        payloads[i],
        messagePayer,
      );
      ixToSend.push(
        await this.squad.buildAddInstruction(
          this.vault,
          proposalAddress,
          instructionToPropose.instruction,
          1 + i,
          instructionToPropose.authorityIndex,
          instructionToPropose.authorityBump,
          instructionToPropose.authorityType,
        ),
      );
    }
    ixToSend.push(await this.activateProposalIx(proposalAddress));
    ixToSend.push(await this.approveProposalIx(proposalAddress));

    const txToSend = TransactionBuilder.batchIntoLegacyTransactions(
      ixToSend,
      priorityFeeConfig,
    );
    await this.sendAllTransactions(txToSend);
    return proposalAddress;
  }

  /**
   * Propose an array of `TransactionInstructions` as one or more proposals
   * @param instructions instructions that will be proposed
   * @param targetCluster the cluster where the instructions should be executed. If the cluster is not the
   * same as the one this multisig is on, execution will use wormhole and the remote executor program.
   * @returns the newly created proposals' public keys
   */
  public async proposeInstructions(
    instructions: TransactionInstruction[],
    targetCluster: PythCluster,
    priorityFeeConfig: PriorityFeeConfig = {},
  ): Promise<PublicKey[]> {
    const msAccount = await this.getMultisigAccount();
    const newProposals = [];

    const remote = targetCluster != this.cluster;

    let ixToSend: TransactionInstruction[] = [];
    if (remote) {
      if (!this.wormholeAddress()) {
        throw new Error("Need wormhole address");
      }
      const batches = batchIntoExecutorPayload(instructions);

      for (let j = 0; j < batches.length; j += MAX_INSTRUCTIONS_PER_PROPOSAL) {
        const proposalIndex =
          msAccount.transactionIndex + 1 + j / MAX_INSTRUCTIONS_PER_PROPOSAL;
        const [proposalIx, newProposalAddress] =
          await this.createProposalIx(proposalIndex);
        ixToSend.push(proposalIx);
        newProposals.push(newProposalAddress);

        for (const [i, batch] of batches
          .slice(j, j + MAX_INSTRUCTIONS_PER_PROPOSAL)
          .entries()) {
          const squadIx = await wrapAsRemoteInstruction(
            this.squad,
            this.vault,
            newProposalAddress,
            batch,
            i + 1,
            this.wormholeAddress()!,
          );
          ixToSend.push(
            await this.squad.buildAddInstruction(
              this.vault,
              newProposalAddress,
              squadIx.instruction,
              i + 1,
              squadIx.authorityIndex,
              squadIx.authorityBump,
              squadIx.authorityType,
            ),
          );
        }
        ixToSend.push(await this.activateProposalIx(newProposalAddress));
        ixToSend.push(await this.approveProposalIx(newProposalAddress));
      }
    } else {
      for (
        let j = 0;
        j < instructions.length;
        j += MAX_INSTRUCTIONS_PER_PROPOSAL
      ) {
        const proposalIndex =
          msAccount.transactionIndex + 1 + j / MAX_INSTRUCTIONS_PER_PROPOSAL;
        const [proposalIx, newProposalAddress] =
          await this.createProposalIx(proposalIndex);
        ixToSend.push(proposalIx);
        newProposals.push(newProposalAddress);

        for (let [i, instruction] of instructions
          .slice(j, j + MAX_INSTRUCTIONS_PER_PROPOSAL)
          .entries()) {
          ixToSend.push(
            await this.squad.buildAddInstruction(
              this.vault,
              newProposalAddress,
              instruction,
              i + 1,
            ),
          );
        }
        ixToSend.push(
          await this.squad.buildActivateTransaction(
            this.vault,
            newProposalAddress,
          ),
        );
        ixToSend.push(
          await this.squad.buildApproveTransaction(
            this.vault,
            newProposalAddress,
          ),
        );
      }
    }

    const txToSend = TransactionBuilder.batchIntoLegacyTransactions(
      ixToSend,
      priorityFeeConfig,
    );

    await this.sendAllTransactions(txToSend);
    return newProposals;
  }

  async sendAllTransactions(transactions: Transaction[]) {
    const provider = this.getAnchorProvider({
      preflightCommitment: "confirmed",
      commitment: "confirmed",
    });

    for (const [index, tx] of transactions.entries()) {
      console.log("Trying transaction: ", index, " of ", transactions.length);

      let retries = 0;
      while (retries < TIMEOUT) {
        try {
          await sendTransactions(
            [{ tx, signers: [] }],
            provider.connection,
            this.squad.wallet as NodeWallet,
            MAX_RETRY_SEND,
          );
          break;
        } catch (e) {
          console.log(e);
          retries++;
        }
      }
      if (retries === TIMEOUT) {
        throw new Error("Too many retries");
      }
    }
  }
}

/**
 * Batch instructions into batches for inclusion in a remote executor payload
 */
export function batchIntoExecutorPayload(
  instructions: TransactionInstruction[],
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

/** Get the size of instructions when serialized as in a remote executor payload */
export function getSizeOfExecutorInstructions(
  instructions: TransactionInstruction[],
) {
  return instructions
    .map((ix) => {
      return 32 + 4 + ix.keys.length * 34 + 4 + ix.data.length;
    })
    .reduce((a, b) => a + b);
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
  squad: SquadsMesh,
  vault: PublicKey,
  proposalAddress: PublicKey,
  instructions: TransactionInstruction[],
  instructionIndex: number,
  wormholeAddress: PublicKey,
): Promise<SquadInstruction> {
  const buffer: Buffer = new ExecutePostedVaa("pythnet", instructions).encode();
  return await getPostMessageInstruction(
    squad,
    vault,
    proposalAddress,
    instructionIndex,
    wormholeAddress,
    buffer,
    getOpsKey(vault),
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
 * @param messagePayer key used as the payer for the wormhole message instruction
 */
async function getPostMessageInstruction(
  squad: SquadsMesh,
  vault: PublicKey,
  proposalAddress: PublicKey,
  instructionIndex: number,
  wormholeAddress: PublicKey,
  payload: Buffer,
  messagePayer: PublicKey,
): Promise<SquadInstruction> {
  const [messagePDA, messagePdaBump] = getIxAuthorityPDA(
    proposalAddress,
    new BN(instructionIndex),
    squad.multisigProgramId,
  );

  const emitter = squad.getAuthorityPDA(vault, 1);
  const provider = new AnchorProvider(
    squad.connection,
    squad.wallet as Wallet,
    AnchorProvider.defaultOptions(),
  );
  const wormholeProgram = createWormholeProgramInterface(
    wormholeAddress,
    provider,
  );

  const accounts = getPostMessageAccounts(
    wormholeAddress,
    emitter,
    messagePayer,
    messagePDA,
  );

  return {
    instruction: await wormholeProgram.methods
      .postMessage(0, payload, 0)
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
  payer: PublicKey,
  message: PublicKey,
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

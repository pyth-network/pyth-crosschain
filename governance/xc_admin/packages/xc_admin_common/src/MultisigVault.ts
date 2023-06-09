import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import SquadsMesh, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  batchIntoExecutorPayload,
  batchIntoTransactions,
  getPostMessageInstruction,
  MAX_INSTRUCTIONS_PER_PROPOSAL,
  sendTransactions,
  wrapAsRemoteInstruction,
} from "./propose";
import { MultisigAccount } from "@sqds/mesh/lib/types";
import { BN } from "bn.js";
import { mapKey } from "./remote_executor";
import { WORMHOLE_ADDRESS } from "./wormhole";
import { AnchorProvider } from "@project-serum/anchor";

/**
 * A multisig vault can sign arbitrary instructions with various vault-controlled PDAs, if the multisig approves.
 * This of course allows the vault to interact with programs on the same blockchain, but a vault also has two
 * other significant capabilities:
 * 1. It can execute arbitrary transactions on other blockchains that have the Remote Executor program.
 *    This allows e.g., a vault on solana mainnet to control programs deployed on PythNet.
 * 2. It can send wormhole messages from the vault authority. This allows the vault to control programs
 *    on other chains using Pyth governance messages.
 *
 * This class encapsulates the parameters of the vault and provides a set of builder interfaces for
 * the
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
    vault: PublicKey
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
      msAccount.authorityIndex
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

  public async proposalsBuilder(): Promise<ProposalsBuilder> {
    const msAccount = await this.getMultisigAccount();
    return new ProposalsBuilder(this, msAccount.transactionIndex + 1);
  }

  /**
   * Get a builder interface for executing instructions on `cluster`. The cluster can either
   * be the same as the one the multisig is on, or it can represent a remote cluster that is
   * connected via wormhole and the remote executor program. (Note that it is the caller's responsibility to
   * ensure that such a connection exists.)
   *
   * @param cluster the cluster on which you would like to execute transactions
   */
  public async ixsBuilder(cluster?: PythCluster): Promise<IxsBuilder> {
    if (cluster === undefined || cluster === this.cluster) {
      return new BatchedBuilder(await this.proposalsBuilder());
    } else {
      return new RemoteExecutorBuilder(this, this.wormholeAddress()!);
    }
  }

  public async proposeInstructions(
    instructions: TransactionInstruction[],
    cluster?: PythCluster
  ): Promise<PublicKey[]> {
    const builder = await this.ixsBuilder(cluster);
    for (const instruction of instructions) {
      await builder.addInstruction(instruction);
    }

    const ixsToSend = await builder.build();
    const provider = await new AnchorProvider(
      this.squad.connection,
      this.wallet,
      {
        preflightCommitment: "processed",
        commitment: "confirmed",
      }
    );
    await sendTransactions(provider, batchIntoTransactions(ixsToSend));
  }

  public async proposeWormholePayload(payload: Buffer) {
    const builder = await this.proposalsBuilder();
    const proposal = await builder.addProposal();

    proposal.addInstructionWithAuthority(async (authority) => {
      return await getPostMessageInstruction(
        this,
        authority,
        this.wormholeAddress()!,
        payload
      );
    });

    const ixsToSend = await builder.build();
    const provider = await new AnchorProvider(
      this.squad.connection,
      this.wallet,
      {
        preflightCommitment: "processed",
        commitment: "confirmed",
      }
    );
    await sendTransactions(provider, batchIntoTransactions(ixsToSend));
  }

  // Convenience wrappers around squads methods

  public async createProposalIx(
    proposalIndex: number
  ): Promise<[TransactionInstruction, PublicKey]> {
    const msAccount = await this.squad.getMultisig(this.vault);

    const ix = await this.squad.buildCreateTransaction(
      msAccount.publicKey,
      msAccount.authorityIndex,
      proposalIndex
    );

    const newProposalAddress = getTxPDA(
      this.vault,
      new BN(proposalIndex),
      this.squad.multisigProgramId
    )[0];

    return [ix, newProposalAddress];
  }

  public async activateProposalIx(
    proposalAddress: PublicKey
  ): Promise<TransactionInstruction> {
    return await this.squad.buildActivateTransaction(
      this.vault,
      proposalAddress
    );
  }

  public async approveProposalIx(
    proposalAddress: PublicKey
  ): Promise<TransactionInstruction> {
    return await this.squad.buildApproveTransaction(
      this.vault,
      proposalAddress
    );
  }
}

/**
 * A builder for construction a set of multisig proposals. The expected usage is to call
 * `addProposal` for each new proposal, then use those proposal builders to add
 * individual instructions to each one.
 *
 * Note that you should only have one active builder for any given vault, as
 * each vault proposal has a global index on the blockchain. If you have multiple active builders,
 * they will attempt to create proposals with the same index.
 */
export class ProposalsBuilder {
  private admin: MultisigVault;
  // The index that the next created proposal should use
  private nextProposalIndex: number;
  private proposals: ProposalBuilder[];

  constructor(admin: MultisigVault, nextProposalIndex: number) {
    this.admin = admin;
    this.nextProposalIndex = nextProposalIndex;
    this.proposals = [];
  }

  public async addProposal(): Promise<ProposalBuilder> {
    const curProposalIndex = this.nextProposalIndex;
    this.nextProposalIndex += 1;

    const [ix, proposalAddress] = await this.admin.createProposalIx(
      curProposalIndex
    );
    return new ProposalBuilder(
      this.admin,
      curProposalIndex,
      proposalAddress,
      ix
    );
  }

  public async build(): Promise<TransactionInstruction[]> {
    const ixs = [];
    for (const proposal of this.proposals) {
      ixs.push(...(await proposal.build()));
    }
    return ixs;
  }
}

/**
 * Interface for building a collection of instructions. The builder may internally transform
 * the instructions, i.e., the result of `build()` may not exactly equal the added instructions.
 */
export interface IxsBuilder {
  addInstruction(instruction: TransactionInstruction): Promise<IxsBuilder>;
  build(): Promise<TransactionInstruction[]>;
}

/**
 * Authorized version of `IxsBuilder` that allows you to sign instructions with an authority
 * that is specific to that single instruction.
 */
export interface AuthorizedIxsBuilder extends IxsBuilder {
  addInstructionWithAuthority(
    factory: (authority: ProposalIxAuthority) => Promise<TransactionInstruction>
  ): Promise<AuthorizedIxsBuilder>;
}

/**
 * Builder that puts the added instructions into a multisig proposal, then activates and
 * approves the proposal.
 *
 * Note that squads multisig proposals have a limited size. If too many instructions are added
 * to this builder and the size limit is exceeded, the built instructions will not execute successfully.
 */
export class ProposalBuilder implements AuthorizedIxsBuilder {
  private admin: MultisigVault;
  public proposalIndex: number;

  public proposalAddress: PublicKey;
  private instructions: TransactionInstruction[];

  constructor(
    admin: MultisigVault,
    proposalIndex: number,
    proposalAddress: PublicKey,
    createProposalIx: TransactionInstruction
  ) {
    this.admin = admin;
    this.proposalIndex = proposalIndex;
    this.proposalAddress = proposalAddress;

    this.instructions = [createProposalIx];
  }

  public async addInstruction(instruction: TransactionInstruction) {
    this.instructions.push(
      await this.admin.squad.buildAddInstruction(
        this.admin.vault,
        this.proposalAddress,
        instruction,
        this.instructions.length
      )
    );
    return this;
  }

  public async addInstructionWithAuthority(
    factory: (authority: ProposalIxAuthority) => Promise<TransactionInstruction>
  ) {
    const instructionIndex = this.instructions.length;
    const authorityType = "custom";
    const [pda, bump] = getIxAuthorityPDA(
      this.proposalAddress,
      new BN(instructionIndex),
      this.admin.squad.multisigProgramId
    );
    const innerInstruction = await factory({
      pda,
      index: instructionIndex,
      bump,
      type: authorityType,
    });
    const instruction = await this.admin.squad.buildAddInstruction(
      this.admin.vault,
      this.proposalAddress,
      innerInstruction,
      instructionIndex,
      instructionIndex,
      bump,
      authorityType
    );
    this.instructions.push(instruction);
    return this;
  }

  public async build(): Promise<TransactionInstruction[]> {
    const txs = [...this.instructions];
    txs.push(await this.admin.activateProposalIx(this.proposalAddress));
    txs.push(await this.admin.approveProposalIx(this.proposalAddress));

    return txs;
  }

  /**
   * Gets the number of instructions added to this builder. Note this is not equivalent to the
   * number of instructions returned by `build()`.
   */
  public length() {
    return this.instructions.length - 1;
  }
}

/**
 * A builder that puts the added instructions into one or more multisig proposals, automatically
 * creating new proposals as needed to accommodate however many instructions are added.
 * This class is a workaround to the squads proposal size limit.
 */
export class BatchedBuilder implements AuthorizedIxsBuilder {
  private builder: ProposalsBuilder;
  private maxInstructionsPerProposal;

  private currentProposal: ProposalBuilder | undefined;

  constructor(
    builder: ProposalsBuilder,
    maxInstructionsPerProposal = MAX_INSTRUCTIONS_PER_PROPOSAL
  ) {
    this.builder = builder;
    this.maxInstructionsPerProposal = maxInstructionsPerProposal;
    this.currentProposal = undefined;
  }

  private async advanceProposalIfNeeded() {
    if (this.currentProposal === undefined) {
      this.currentProposal = await this.builder.addProposal();
    } else if (
      this.currentProposal.length() == this.maxInstructionsPerProposal
    ) {
      this.currentProposal = await this.builder.addProposal();
    }
  }

  public async addInstruction(instruction: TransactionInstruction) {
    await this.advanceProposalIfNeeded();
    await this.currentProposal!.addInstruction(instruction);
    return this;
  }

  public async addInstructionWithAuthority(
    factory: (authority: ProposalIxAuthority) => Promise<TransactionInstruction>
  ) {
    await this.advanceProposalIfNeeded();
    await this.currentProposal!.addInstructionWithAuthority(factory);
    return this;
  }

  public async build(): Promise<TransactionInstruction[]> {
    return await this.builder.build();
  }
}

/**
 * Builder that executes the added instructions on a remote Solana network
 * (e.g., Pythnet) using the remote executor program.
 */
export class RemoteExecutorBuilder implements IxsBuilder {
  private vault: MultisigVault;
  private wormholeAddress: PublicKey;
  private instructions: TransactionInstruction[];

  constructor(vault: MultisigVault, wormholeAddress: PublicKey) {
    this.vault = vault;
    this.wormholeAddress = wormholeAddress;
    this.instructions = [];
  }

  public async addInstruction(instruction: TransactionInstruction) {
    this.instructions.push(instruction);
    return this;
  }

  public async build(): Promise<TransactionInstruction[]> {
    const builder = new BatchedBuilder(await this.vault.proposalsBuilder());
    const batches = batchIntoExecutorPayload(this.instructions);
    for (const [i, batch] of batches.entries()) {
      await builder.addInstructionWithAuthority(
        async (authority: ProposalIxAuthority) => {
          return await wrapAsRemoteInstruction(
            this.vault,
            authority,
            this.wormholeAddress,
            batch
          );
        }
      );
    }

    return await builder.build();
  }
}

/** A PDA that can act as the signer for a specific instruction in a multisig proposal. */
export interface ProposalIxAuthority {
  pda: PublicKey;
  index: number;
  bump: number;
  type: string;
}

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
  MAX_INSTRUCTIONS_PER_PROPOSAL,
  wrapAsRemoteInstruction,
} from "./propose";
import { MultisigAccount } from "@sqds/mesh/lib/types";
import { BN } from "bn.js";

class PythComponentManager {
  public tokenAccount(cluster: PythCluster) {}

  public oracleProgram(cluster: PythCluster) {}
}

export interface TxWrapper {
  wrap: (
    instructions: TransactionInstruction[]
  ) => Promise<TransactionInstruction[]>;
}

export class SquadWrapper {
  private admin: PythAdmin;

  constructor(admin: PythAdmin) {
    this.admin = admin;
  }

  public async wrap(
    instructions: TransactionInstruction[]
  ): Promise<TransactionInstruction[]> {
    const ixToSend: TransactionInstruction[] = [];
    const newProposals = [];

    const msAccount = await this.admin.getMultisigAccount();
    for (
      let j = 0;
      j < instructions.length;
      j += MAX_INSTRUCTIONS_PER_PROPOSAL
    ) {
      const proposalIndex =
        msAccount.transactionIndex + 1 + j / MAX_INSTRUCTIONS_PER_PROPOSAL;
      ixToSend.push(
        await this.admin.squad.buildCreateTransaction(
          msAccount.publicKey,
          msAccount.authorityIndex,
          proposalIndex
        )
      );
      const newProposalAddress = getTxPDA(
        this.admin.vault,
        new BN(proposalIndex),
        this.admin.squad.multisigProgramId
      )[0];
      newProposals.push(newProposalAddress);

      for (let [i, instruction] of instructions
        .slice(j, j + MAX_INSTRUCTIONS_PER_PROPOSAL)
        .entries()) {
        ixToSend.push(
          await this.admin.squad.buildAddInstruction(
            this.admin.vault,
            newProposalAddress,
            instruction,
            i + 1
          )
        );
      }
      ixToSend.push(
        await this.admin.squad.buildActivateTransaction(
          this.admin.vault,
          newProposalAddress
        )
      );
      ixToSend.push(
        await this.admin.squad.buildApproveTransaction(
          this.admin.vault,
          newProposalAddress
        )
      );
    }

    return ixToSend;
  }
}

export class RemoteWrapper implements TxWrapper {
  private admin: PythAdmin;

  constructor(admin: PythAdmin) {
    this.admin = admin;
  }

  public async wrap(
    instructions: TransactionInstruction[]
  ): Promise<TransactionInstruction[]> {
    const ixToSend: TransactionInstruction[] = [];
    const newProposals = [];

    const msAccount = await this.admin.getMultisigAccount();
    for (
      let j = 0;
      j < instructions.length;
      j += MAX_INSTRUCTIONS_PER_PROPOSAL
    ) {
      const proposalIndex =
        msAccount.transactionIndex + 1 + j / MAX_INSTRUCTIONS_PER_PROPOSAL;
      ixToSend.push(
        await this.admin.squad.buildCreateTransaction(
          msAccount.publicKey,
          msAccount.authorityIndex,
          proposalIndex
        )
      );
      const newProposalAddress = getTxPDA(
        this.admin.vault,
        new BN(proposalIndex),
        this.admin.squad.multisigProgramId
      )[0];
      newProposals.push(newProposalAddress);

      for (let [i, instruction] of instructions
        .slice(j, j + MAX_INSTRUCTIONS_PER_PROPOSAL)
        .entries()) {
        ixToSend.push(
          await this.admin.squad.buildAddInstruction(
            this.admin.vault,
            newProposalAddress,
            instruction,
            i + 1
          )
        );
      }
      ixToSend.push(
        await this.admin.squad.buildActivateTransaction(
          this.admin.vault,
          newProposalAddress
        )
      );
      ixToSend.push(
        await this.admin.squad.buildApproveTransaction(
          this.admin.vault,
          newProposalAddress
        )
      );
    }

    return ixToSend;
  }
}

class DefaultBuilder implements TxBuilder {
  public build() {}
}

class TokenAccountTxBuilder implements TxBuilder {
  private admin: PythAdmin;

  // Tokens will be sent from this account / cluster.
  private fromPubkey: PublicKey;

  private instructions: TransactionInstruction[];

  private wrapper: TxWrapper;

  constructor(admin: PythAdmin) {
    this.admin = admin;
    this.instructions = [];
  }

  // TODO: this needs to be a bignumber
  public transferSol(qtyLamports: number, to: PublicKey) {
    const proposalInstruction: TransactionInstruction = SystemProgram.transfer({
      fromPubkey: this.fromPubkey,
      toPubkey: to,
      lamports: qtyLamports,
    });

    this.instructions.push(proposalInstruction);
  }

  public build(): TransactionInstruction[] {
    return this.wrapper.wrap(this.instructions);
  }
}

class RemoteExecutorTxBuilder {
  private admin: PythAdmin;

  constructor(admin: PythAdmin) {
    this.admin = admin;
  }
}

class OracleProgramTxBuilder {
  private admin: PythAdmin;

  constructor(admin: PythAdmin) {
    this.admin = admin;
  }
}

// todo extract to an interface
class PythAdmin {
  public wallet: Wallet;
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

  public async getAuthorityPDA(authorityIndex: number = 1): Promise<PublicKey> {
    return await this.squad.getAuthorityPDA(this.vault, authorityIndex);
  }

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

  public tokenAccount() {}

  public remoteExecutor() {
    return new RemoteExecutorTxBuilder(this);
  }
}

export class MultisigBuilder {
  private admin: PythAdmin;
  // msAccount.transactionIndex + 1
  private nextProposalIndex: number;

  private proposals: ProposalBuilder[];

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

  /*
  public async buildTxs(): Promise<Transaction[]> {

  }
   */
}

export interface IBuilder {
  addInstruction(instruction: TransactionInstruction): Promise<void>;
  build(): Promise<TransactionInstruction[]>;
}

export interface IProposalBuilder extends IBuilder {
  addInstructionWithAuthority(
    factory: (authority: SquadsAuthority) => Promise<TransactionInstruction>
  ): Promise<void>;
}

export class ProposalBuilder implements IProposalBuilder {
  private admin: PythAdmin;
  public proposalIndex: number;

  public proposalAddress: PublicKey;
  private instructions: TransactionInstruction[];

  constructor(
    admin: PythAdmin,
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
  }

  // Each instruction within a proposal can sign with its own PDA
  public async addInstructionWithAuthority(
    factory: (authority: SquadsAuthority) => Promise<TransactionInstruction>
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
  }

  public async build(): Promise<TransactionInstruction[]> {
    // TODO: maybe this should be a separate method ?
    this.instructions.push(
      await this.admin.activateProposalIx(this.proposalAddress)
    );
    this.instructions.push(
      await this.admin.approveProposalIx(this.proposalAddress)
    );

    return this.instructions;
  }

  public length() {
    // FIXME: this fails once you call build
    return this.instructions.length - 1;
  }
}

export class BatchedBuilder implements IProposalBuilder {
  private builder: MultisigBuilder;
  private currentProposal: ProposalBuilder | undefined;

  private async advanceProposalIfNeeded() {
    if (this.currentProposal === undefined) {
      this.currentProposal = await this.builder.addProposal();
    } else if (this.currentProposal.length() == MAX_INSTRUCTIONS_PER_PROPOSAL) {
      this.currentProposal = await this.builder.addProposal();
    }
  }

  public async addInstruction(instruction: TransactionInstruction) {
    await this.advanceProposalIfNeeded();
    await this.currentProposal!.addInstruction(instruction);
  }

  public async addInstructionWithAuthority(
    factory: (authority: SquadsAuthority) => Promise<TransactionInstruction>
  ) {
    await this.advanceProposalIfNeeded();
    await this.currentProposal!.addInstructionWithAuthority(factory);
  }

  public async build(): Promise<TransactionInstruction[]> {
    return await this.builder.build();
  }
}

/**
 * Executes instructions on a remote Solana network (e.g., Pythnet) using
 * the remote executor program.
 */
export class RemoteBuilder implements IBuilder {
  private builder: IProposalBuilder;
  private wormholeAddress: PublicKey;

  private instructions: TransactionInstruction[];

  public async addInstruction(instruction: TransactionInstruction) {
    this.instructions.push(instruction);
  }

  public async build(): Promise<TransactionInstruction[]> {
    const batches = batchIntoExecutorPayload(this.instructions);
    for (const [i, batch] of batches.entries()) {
      this.builder.addInstructionWithAuthority(
        async (authority: SquadsAuthority) => {
          return await wrapAsRemoteInstruction(
            this.builder.admin,
            authority,
            this.wormholeAddress,
            batch
          );
        }
      );
    }

    return await this.builder.build();
  }
}

export class OracleProgramAdmin {
  private builder: IBuilder;

  public async addPublisher() {
    // builder.addInstruction()
  }
}

export class CosmosTxBuilder {
  private builder: IProposalBuilder;
  private wormholeAddress: PublicKey;

  public async addSetFee() {
    // make wh governance payload,
    this.builder.addInstructionWithAuthority(async (authority) => {
      return await getPostMessageInstruction(
        builder.admin,
        authority,
        wormholeAddress,
        payload
      );
    });
  }
}

export interface SquadsAuthority {
  pda: PublicKey;
  index: number;
  bump: number;
  type: string;
}

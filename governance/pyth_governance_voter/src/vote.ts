import type { VoterWeightAction } from "@pythnetwork/staking-sdk";
import {
  getMaxVoterWeightRecordAddress,
  getVoterWeightRecordAddress,
  PythStakingClient,
} from "@pythnetwork/staking-sdk";
import {
  getGovernance,
  getProposal,
  getTokenOwnerRecordAddress,
  PROGRAM_VERSION_V2,
  Vote,
  VoteChoice,
  VoteKind,
  withCastVote,
} from "@solana/spl-governance";
import type {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";

export type VoteSide = "yes" | "no";

export type InstructionSummary = {
  name: string;
  programId: string;
  accountCount: number;
  dataLength: number;
};

export type VoteSummary = {
  proposal: string;
  side: VoteSide;
  voter: string;
  stakeAccount: string;
  realm: string;
  governance: string;
  governingTokenMint: string;
  tokenOwnerRecord: string;
  voterWeightRecord: string;
  maxVoterWeightRecord: string;
  feePayer: string;
  instructions: InstructionSummary[];
};

export type CastVoteParams = {
  connection: Connection;
  voter: PublicKey;
  stakeAccount: PublicKey;
  proposal: PublicKey;
  side: VoteSide;
};

export type CastVoteResult = {
  transaction: Transaction;
  summary: VoteSummary;
};

/**
 * Maps the yes/no CLI argument to an SPL Governance V2 {@link Vote}. `yes`
 * approves with 100% weight on the single choice; `no` is a plain deny.
 */
export const buildVote = (side: VoteSide): Vote => {
  if (side === "yes") {
    return new Vote({
      approveChoices: [new VoteChoice({ rank: 0, weightPercentage: 100 })],
      deny: undefined,
      veto: undefined,
      voteType: VoteKind.Approve,
    });
  }
  return new Vote({
    approveChoices: undefined,
    deny: true,
    veto: undefined,
    voteType: VoteKind.Deny,
  });
};

const rejectStakingWalletUsage = (): never => {
  throw new Error(
    "Pyth staking client wallet is read-only while constructing a vote",
  );
};

/**
 * Builds the two-instruction vote transaction:
 *  1. `updateVoterWeight(CastVote)` on the Pyth staking program, with the
 *     proposal passed as the remaining account the program reads to pin the
 *     voter weight to the proposal's voting epoch.
 *  2. `castVote` on SPL Governance, consuming the freshly stamped voter weight
 *     record. Both must ride in the same transaction for the weight to be valid.
 *
 * The transaction is returned without a blockhash or signatures so the caller
 * can attach a recent blockhash and sign via the selected wallet.
 */
export const buildCastVoteTransaction = async (
  params: CastVoteParams,
): Promise<CastVoteResult> => {
  const { connection, voter, stakeAccount, proposal, side } = params;

  const proposalAccount = await getProposal(connection, proposal);
  // The program that owns the proposal account is the Pyth governance program.
  const governanceProgram = proposalAccount.owner;
  const governance = proposalAccount.account.governance;
  const proposalOwnerRecord = proposalAccount.account.tokenOwnerRecord;
  const governingTokenMint = proposalAccount.account.governingTokenMint;

  const governanceAccount = await getGovernance(connection, governance);
  const realm = governanceAccount.account.realm;

  const tokenOwnerRecord = await getTokenOwnerRecordAddress(
    governanceProgram,
    realm,
    governingTokenMint,
    voter,
  );

  const [voterWeightRecord] = getVoterWeightRecordAddress(stakeAccount);
  const [maxVoterWeightRecord] = getMaxVoterWeightRecordAddress();

  const stakingClient = new PythStakingClient({
    connection,
    wallet: {
      publicKey: voter,
      sendTransaction: rejectStakingWalletUsage,
      signAllTransactions: rejectStakingWalletUsage,
      signTransaction: rejectStakingWalletUsage,
    },
  });

  const castVoteAction: VoterWeightAction = { castVote: {} };
  const updateVoterWeightIx =
    await stakingClient.getUpdateVoterWeightInstruction(
      stakeAccount,
      castVoteAction,
      proposal,
    );

  const instructions: TransactionInstruction[] = [updateVoterWeightIx];
  const castVoteStartIndex = instructions.length;

  await withCastVote(
    instructions,
    governanceProgram,
    PROGRAM_VERSION_V2,
    realm,
    governance,
    proposal,
    proposalOwnerRecord,
    tokenOwnerRecord,
    voter,
    governingTokenMint,
    buildVote(side),
    voter,
    voterWeightRecord,
    maxVoterWeightRecord,
  );

  const transaction = new Transaction();
  transaction.add(...instructions);
  transaction.feePayer = voter;

  const summary: VoteSummary = {
    feePayer: voter.toBase58(),
    governance: governance.toBase58(),
    governingTokenMint: governingTokenMint.toBase58(),
    instructions: instructions.map((instruction, index) => ({
      accountCount: instruction.keys.length,
      dataLength: instruction.data.length,
      name:
        index < castVoteStartIndex
          ? "updateVoterWeight (Pyth staking)"
          : "castVote (SPL Governance)",
      programId: instruction.programId.toBase58(),
    })),
    maxVoterWeightRecord: maxVoterWeightRecord.toBase58(),
    proposal: proposal.toBase58(),
    realm: realm.toBase58(),
    side,
    stakeAccount: stakeAccount.toBase58(),
    tokenOwnerRecord: tokenOwnerRecord.toBase58(),
    voter: voter.toBase58(),
    voterWeightRecord: voterWeightRecord.toBase58(),
  };

  return { summary, transaction };
};

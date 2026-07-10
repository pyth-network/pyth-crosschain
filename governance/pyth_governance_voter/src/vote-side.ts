import { Vote, VoteChoice, VoteKind } from "@solana/spl-governance";

export type VoteSide = "yes" | "no";

/**
 * Maps the yes/no CLI argument to an SPL Governance V2 {@link Vote}. `yes`
 * approves with 100% weight on the single choice; `no` is a plain deny.
 *
 * Kept in its own module — importing only `@solana/spl-governance` — so the
 * unit test can exercise it without pulling in the Pyth staking client, whose
 * transitive ESM-only dependencies Jest cannot `require()`.
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

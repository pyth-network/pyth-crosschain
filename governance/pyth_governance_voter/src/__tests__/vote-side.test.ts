import { VoteKind } from "@solana/spl-governance";
import { buildVote } from "../vote-side.js";

describe("buildVote", () => {
  it("maps yes to an Approve vote with 100% weight on rank 0", () => {
    const vote = buildVote("yes");
    expect(vote.voteType).toBe(VoteKind.Approve);
    expect(vote.approveChoices).toEqual([{ rank: 0, weightPercentage: 100 }]);
    expect(vote.deny).toBeUndefined();
    expect(vote.veto).toBeUndefined();
  });

  it("maps no to a Deny vote with no approve choices", () => {
    const vote = buildVote("no");
    expect(vote.voteType).toBe(VoteKind.Deny);
    expect(vote.approveChoices).toBeUndefined();
    expect(vote.deny).toBe(true);
    expect(vote.veto).toBeUndefined();
  });
});

import {
  stakeGovernance,
  cancelWarmupGovernance,
  unstakeGovernance,
} from "../../api";
import { ProgramSection } from "../ProgramSection";

type Props = {
  availableToStake: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
};

export const Governance = ({
  availableToStake,
  warmup,
  staked,
  cooldown,
  cooldown2,
}: Props) => (
  <ProgramSection
    name="Governance"
    description="Vote and Influence the Network"
    positions={{
      available: availableToStake,
      warmup,
      staked,
      cooldown,
      cooldown2,
      stake: stakeGovernance,
      stakeDescription: "Stake funds to participate in governance votes",
      cancelWarmup: cancelWarmupGovernance,
      cancelWarmupDescription:
        "Cancel staking tokens for governance that are currently in warmup",
      unstake: unstakeGovernance,
      unstakeDescription: "Unstake tokens from the Governance program",
    }}
  />
);

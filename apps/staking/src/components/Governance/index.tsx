import { type States, StateType as ApiStateType } from "../../hooks/use-api";
import { ProgramSection } from "../ProgramSection";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  availableToStake: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
};

export const Governance = ({
  api,
  availableToStake,
  warmup,
  staked,
  cooldown,
  cooldown2,
}: Props) => (
  <ProgramSection
    name="Governance"
    description="Vote and Influence the Network"
    available={availableToStake}
    warmup={warmup}
    staked={staked}
    cooldown={cooldown}
    cooldown2={cooldown2}
    stake={api.type === ApiStateType.Loaded ? api.stakeGovernance : undefined}
    stakeDescription="Stake funds to participate in governance votes"
    cancelWarmup={
      api.type === ApiStateType.Loaded ? api.cancelWarmupGovernance : undefined
    }
    cancelWarmupDescription="Cancel staking tokens for governance that are currently in warmup"
    unstake={
      api.type === ApiStateType.Loaded ? api.unstakeGovernance : undefined
    }
    unstakeDescription="Unstake tokens from the Governance program"
  />
);

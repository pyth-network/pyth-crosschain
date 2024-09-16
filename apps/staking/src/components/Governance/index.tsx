import { type States, StateType as ApiStateType } from "../../hooks/use-api";
import { GovernanceGuide } from "../GovernanceGuide";
import { ProgramSection } from "../ProgramSection";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  currentEpoch: bigint;
  availableToStake: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
};

export const Governance = ({
  api,
  currentEpoch,
  availableToStake,
  warmup,
  staked,
  cooldown,
  cooldown2,
}: Props) => (
  <ProgramSection
    name="Pyth Governance"
    helpDialog={<GovernanceGuide />}
    tagline="Vote and Influence the Network"
    description="Pyth Governance lets the community influence the direction of the Pyth Network by voting on key proposals. By staking tokens, community members can gain a say in decisions that shape the network’s operations and development, ensuring Pyth Network evolves effectively and aligns with DeFi’s needs."
    currentEpoch={currentEpoch}
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

import clsx from "clsx";

import type { States } from "../../hooks/use-api";
import { StateType as ApiStateType } from "../../hooks/use-api";
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
  allowStaking?: boolean | undefined;
};

export const Governance = ({
  api,
  currentEpoch,
  availableToStake,
  warmup,
  staked,
  cooldown,
  cooldown2,
  allowStaking,
}: Props) => (
  <ProgramSection
    className={clsx({ "border-t sm:border-t-0": !allowStaking })}
    name="Pyth Governance"
    helpDialog={<GovernanceGuide />}
    tagline="Vote and Influence the Network"
    description="Pyth Governance lets the community influence the direction of the Pyth Network by voting on key proposals. By staking tokens, community members can gain a say in decisions that shape the network’s operations and development, ensuring Pyth Network evolves effectively and aligns with DeFi’s needs."
    tokenOverview={{
      currentEpoch,
      available: availableToStake,
      warmup,
      staked,
      cooldown,
      cooldown2,
      cancelWarmup:
        api.type === ApiStateType.Loaded
          ? api.cancelWarmupGovernance
          : undefined,
      cancelWarmupDescription:
        "Cancel staking tokens for governance that are currently in warmup",
      unstake:
        api.type === ApiStateType.Loaded ? api.unstakeGovernance : undefined,
      unstakeDescription: "Unstake tokens from the Governance program",
      ...(allowStaking && {
        stake:
          api.type === ApiStateType.Loaded ? api.stakeGovernance : undefined,
        stakeDescription: "Stake funds to participate in governance votes",
      }),
    }}
  />
);

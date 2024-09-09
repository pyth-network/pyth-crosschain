import { type ComponentProps, useMemo } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";

import { AccountSummary } from "../AccountSummary";
import { Governance } from "../Governance";
import { OracleIntegrityStaking } from "../OracleIntegrityStaking";
import { Styled } from "../Styled";

type Props = {
  total: bigint;
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  walletAmount: bigint;
  availableRewards: bigint;
  expiringRewards:
    | {
        amount: bigint;
        expiry: Date;
      }
    | undefined;
  locked: bigint;
  unlockSchedule: {
    amount: bigint;
    date: Date;
  }[];
  governance: {
    warmup: bigint;
    staked: bigint;
    cooldown: bigint;
    cooldown2: bigint;
  };
  integrityStakingPublishers: ComponentProps<
    typeof OracleIntegrityStaking
  >["publishers"];
};

export const Dashboard = ({
  total,
  lastSlash,
  walletAmount,
  availableRewards,
  expiringRewards,
  governance,
  integrityStakingPublishers,
  locked,
  unlockSchedule,
}: Props) => {
  const availableToStakeGovernance = useMemo(
    () =>
      total -
      governance.warmup -
      governance.staked -
      governance.cooldown -
      governance.cooldown2,
    [
      total,
      governance.warmup,
      governance.staked,
      governance.cooldown,
      governance.cooldown2,
    ],
  );

  const integrityStakingWarmup = useIntegrityStakingSum(
    integrityStakingPublishers,
    "warmup",
  );
  const integrityStakingStaked = useIntegrityStakingSum(
    integrityStakingPublishers,
    "staked",
  );
  const integrityStakingCooldown = useIntegrityStakingSum(
    integrityStakingPublishers,
    "cooldown",
  );
  const integrityStakingCooldown2 = useIntegrityStakingSum(
    integrityStakingPublishers,
    "cooldown2",
  );

  const availableToStakeIntegrity = useMemo(
    () =>
      total -
      locked -
      integrityStakingWarmup -
      integrityStakingStaked -
      integrityStakingCooldown -
      integrityStakingCooldown2,
    [
      total,
      locked,
      integrityStakingWarmup,
      integrityStakingStaked,
      integrityStakingCooldown,
      integrityStakingCooldown2,
    ],
  );

  const availableToWithdraw = useMemo(
    () => bigIntMin(availableToStakeGovernance, availableToStakeIntegrity),
    [availableToStakeGovernance, availableToStakeIntegrity],
  );

  return (
    <div className="flex w-full flex-col gap-8">
      <AccountSummary
        locked={locked}
        unlockSchedule={unlockSchedule}
        lastSlash={lastSlash}
        walletAmount={walletAmount}
        total={total}
        availableToWithdraw={availableToWithdraw}
        availableRewards={availableRewards}
        expiringRewards={expiringRewards}
      />
      <Tabs>
        <TabList
          className="mb-8 flex w-full flex-row text-sm font-medium sm:text-base"
          aria-label="Programs"
        >
          <DashboardTab id={TabIds.Overview}>Overview</DashboardTab>
          <DashboardTab id={TabIds.Governance}>Governance</DashboardTab>
          <DashboardTab id={TabIds.IntegrityStaking}>
            <span className="sm:hidden">Integrity Staking</span>
            <span className="hidden sm:inline">
              Oracle Integrity Staking (OIS)
            </span>
          </DashboardTab>
        </TabList>
        <DashboardTabPanel id={TabIds.Overview}>
          <section className="py-20">
            <p className="text-center">
              This is an overview of the staking programs
            </p>
          </section>
        </DashboardTabPanel>
        <DashboardTabPanel id={TabIds.Governance}>
          <Governance
            availableToStake={availableToStakeGovernance}
            warmup={governance.warmup}
            staked={governance.staked}
            cooldown={governance.cooldown}
            cooldown2={governance.cooldown2}
          />
        </DashboardTabPanel>
        <DashboardTabPanel id={TabIds.IntegrityStaking}>
          <OracleIntegrityStaking
            availableToStake={availableToStakeIntegrity}
            locked={locked}
            warmup={integrityStakingWarmup}
            staked={integrityStakingStaked}
            cooldown={integrityStakingCooldown}
            cooldown2={integrityStakingCooldown2}
            publishers={integrityStakingPublishers}
          />
        </DashboardTabPanel>
      </Tabs>
    </div>
  );
};

const DashboardTab = Styled(
  Tab,
  "grow basis-0 border-b border-neutral-600/50 px-4 py-2 focus-visible:outline-none selected:cursor-default selected:border-pythpurple-400 selected:hover:bg-transparent hover:text-pythpurple-400 selected:text-pythpurple-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 cursor-pointer text-center",
);

const DashboardTabPanel = Styled(
  TabPanel,
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400/50",
);

const useIntegrityStakingSum = (
  publishers: Props["integrityStakingPublishers"],
  field: "warmup" | "staked" | "cooldown" | "cooldown2",
): bigint =>
  useMemo(
    () =>
      publishers
        .map((publisher) => publisher.positions?.[field] ?? 0n)
        .reduce((acc, cur) => acc + cur, 0n),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    publishers.map((publisher) => publisher.positions?.[field]),
  );

// eslint-disable-next-line unicorn/no-array-reduce
const bigIntMin = (...args: bigint[]) => args.reduce((m, e) => (e < m ? e : m));

enum TabIds {
  Overview,
  Governance,
  IntegrityStaking,
}

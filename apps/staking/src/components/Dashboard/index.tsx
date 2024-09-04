import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { type ComponentProps, useMemo } from "react";

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
  expiringRewards: {
    amount: bigint;
    expiry: Date;
  };
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
      <TabGroup as="section">
        <TabList className="flex w-full flex-row font-medium">
          <DashboardTab>Overview</DashboardTab>
          <DashboardTab>Governance</DashboardTab>
          <DashboardTab>Oracle Integrity Staking</DashboardTab>
        </TabList>
        <TabPanels className="mt-8">
          <DashboardTabPanel>
            <section className="py-20">
              <p className="text-center">
                This is an overview of the staking programs
              </p>
            </section>
          </DashboardTabPanel>
          <DashboardTabPanel>
            <Governance
              availableToStake={availableToStakeGovernance}
              warmup={governance.warmup}
              staked={governance.staked}
              cooldown={governance.cooldown}
              cooldown2={governance.cooldown2}
            />
          </DashboardTabPanel>
          <DashboardTabPanel>
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
        </TabPanels>
      </TabGroup>
    </div>
  );
};

const DashboardTab = Styled(
  Tab,
  "grow border-b border-neutral-600/50 px-4 py-2 focus-visible:outline-none data-[selected]:cursor-default data-[selected]:border-pythpurple-400 data-[selected]:data-[hover]:bg-transparent data-[hover]:text-pythpurple-400 data-[selected]:text-pythpurple-400 data-[focus]:outline-none data-[focus]:ring-1 data-[focus]:ring-pythpurple-400",
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

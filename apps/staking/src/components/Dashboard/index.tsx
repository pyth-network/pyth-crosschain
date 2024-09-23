import clsx from "clsx";
import Image, { type StaticImageData } from "next/image";
import {
  type ComponentProps,
  type ReactNode,
  useState,
  useMemo,
  useEffect,
} from "react";
import { Tabs, TabList, TabPanel, Tab } from "react-aria-components";

import type { States, StateType as ApiStateType } from "../../hooks/use-api";
import { AccountSummary } from "../AccountSummary";
import { Governance } from "../Governance";
import governanceImage from "../NoWalletHome/governance.png";
import ois from "../NoWalletHome/ois.png";
import { OracleIntegrityStaking } from "../OracleIntegrityStaking";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  currentEpoch: bigint;
  total: bigint;
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  walletAmount: bigint;
  availableRewards: bigint;
  expiringRewards: Date | undefined;
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
  yieldRate: bigint;
  integrityStakingPublishers: ComponentProps<
    typeof OracleIntegrityStaking
  >["publishers"];
};

export const Dashboard = ({
  api,
  currentEpoch,
  total,
  lastSlash,
  walletAmount,
  availableRewards,
  expiringRewards,
  governance,
  integrityStakingPublishers,
  unlockSchedule,
  yieldRate,
}: Props) => {
  const [tab, setTab] = useState<TabId>(TabIds.Empty);

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

  const locked = useMemo(
    () => unlockSchedule.reduce((sum, { amount }) => sum + amount, 0n),
    [unlockSchedule],
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  return (
    <main className="flex w-full flex-col gap-8 xl:px-4 xl:py-6">
      <AccountSummary
        api={api}
        locked={locked}
        unlockSchedule={unlockSchedule}
        lastSlash={lastSlash}
        walletAmount={walletAmount}
        total={total}
        availableToWithdraw={availableToWithdraw}
        availableRewards={availableRewards}
        expiringRewards={expiringRewards}
      />
      <Tabs
        selectedKey={tab}
        onSelectionChange={setTab}
        className="group border-neutral-600/50 data-[empty]:my-[5dvh] data-[empty]:border data-[empty]:bg-white/10 data-[empty]:p-4 sm:p-4 data-[empty]:sm:my-0 data-[empty]:sm:border-0 data-[empty]:sm:bg-transparent data-[empty]:sm:p-0"
        {...(tab === TabIds.Empty && { "data-empty": true })}
      >
        <h1 className="my-4 hidden text-center text-xl/tight font-light group-data-[empty]:mb-10 group-data-[empty]:block sm:mb-6 sm:text-3xl group-data-[empty]:sm:mb-6 lg:my-14 lg:text-5xl">
          Choose Your Journey
        </h1>
        <TabList className="sticky top-header-height z-10 flex flex-row items-stretch justify-center group-data-[empty]:mx-auto group-data-[empty]:max-w-7xl group-data-[empty]:flex-col group-data-[empty]:gap-8 group-data-[empty]:sm:flex-row group-data-[empty]:sm:gap-2">
          <Tab id={TabIds.Empty} className="hidden" />
          <Journey
            longText="Oracle Integrity Staking (OIS)"
            shortText="OIS"
            image={ois}
            id={TabIds.IntegrityStaking}
          >
            <span>Secure the Oracle</span>
            <br />
            <span className="font-semibold">to Earn Rewards</span>
          </Journey>
          <Journey
            longText="Pyth Governance"
            shortText="Governance"
            image={governanceImage}
            id={TabIds.Governance}
          >
            <span>Gain Voting Power</span>
            <br />
            <span className="font-semibold">for Governance</span>
          </Journey>
        </TabList>
        <TabPanel id={TabIds.Empty}></TabPanel>
        <TabPanel id={TabIds.IntegrityStaking}>
          <OracleIntegrityStaking
            api={api}
            currentEpoch={currentEpoch}
            availableToStake={availableToStakeIntegrity}
            locked={locked}
            warmup={integrityStakingWarmup}
            staked={integrityStakingStaked}
            cooldown={integrityStakingCooldown}
            cooldown2={integrityStakingCooldown2}
            publishers={integrityStakingPublishers}
            yieldRate={yieldRate}
          />
        </TabPanel>
        <TabPanel id={TabIds.Governance}>
          <Governance
            api={api}
            currentEpoch={currentEpoch}
            availableToStake={availableToStakeGovernance}
            warmup={governance.warmup}
            staked={governance.staked}
            cooldown={governance.cooldown}
            cooldown2={governance.cooldown2}
          />
        </TabPanel>
      </Tabs>
    </main>
  );
};

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

type TabId = Exclude<ComponentProps<typeof Tabs>["selectedKey"], undefined>;

type JourneyProps = ComponentProps<typeof Tab> & {
  children: ReactNode | ReactNode[];
  longText: ReactNode;
  shortText: ReactNode;
  image: StaticImageData;
};

const Journey = ({
  className,
  children,
  image,
  longText,
  shortText,
  ...props
}: JourneyProps) => (
  <Tab
    className={clsx(
      "group/tab flex flex-1 cursor-pointer flex-col items-center bg-pythpurple-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 selected:cursor-default group-data-[empty]:sm:bg-transparent",
      className,
    )}
    {...props}
  >
    <div className="grid size-full flex-none basis-0 place-content-center border border-neutral-600/50 bg-pythpurple-800 p-2 text-center font-semibold transition group-data-[empty]:py-8 group-hover/tab:bg-pythpurple-600/30 group-selected/tab:border-pythpurple-400/60 group-selected/tab:bg-pythpurple-600/60 group-hover/tab:group-selected/tab:bg-pythpurple-600/60 sm:py-4 sm:text-lg group-data-[empty]:sm:py-2">
      <span className="hidden group-data-[empty]:inline sm:inline">
        {longText}
      </span>
      <span className="group-data-[empty]:hidden sm:hidden">{shortText}</span>
    </div>
    <div className="relative hidden w-4/5 flex-none overflow-hidden opacity-30 transition group-hover/tab:opacity-100 group-data-[empty]:sm:block">
      <div className="absolute inset-0 bg-[#E6DAFE] mix-blend-color" />
      <Image src={image} alt="" className="size-full object-cover object-top" />
      <div className="absolute inset-0 top-16 text-center text-xl text-pythpurple-800 md:text-2xl lg:text-3xl">
        {children}
      </div>
    </div>
  </Tab>
);

export enum TabIds {
  Empty = "empty",
  Governance = "governance",
  IntegrityStaking = "ois",
}

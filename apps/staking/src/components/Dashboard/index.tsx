import { useLocalStorageValue } from "@react-hookz/web";
import clsx from "clsx";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import type { ComponentProps, ReactNode, FormEvent } from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, TabList, TabPanel, Tab, Form } from "react-aria-components";

import type { States, StateType as ApiStateType } from "../../hooks/use-api";
import { AccountSummary } from "../AccountSummary";
import { Button, LinkButton } from "../Button";
import { Checkbox } from "../Checkbox";
import { Governance } from "../Governance";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";
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
  enableGovernance: boolean;
  enableOis: boolean;
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
  enableGovernance,
  enableOis,
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
    <>
      <main
        className={clsx("flex w-full flex-col gap-4 xl:px-4", {
          "sm:gap-0": !enableOis,
        })}
      >
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
          enableGovernance={enableGovernance}
          enableOis={enableOis}
          integrityStakingWarmup={integrityStakingWarmup}
          integrityStakingStaked={integrityStakingStaked}
          integrityStakingCooldown={integrityStakingCooldown}
          integrityStakingCooldown2={integrityStakingCooldown2}
          currentEpoch={currentEpoch}
        />
        {enableOis ? (
          <Tabs
            selectedKey={tab}
            onSelectionChange={setTab}
            className="group border-neutral-600/50 data-[empty]:my-[5dvh] data-[empty]:border data-[empty]:bg-white/10 data-[empty]:p-4 sm:p-4 data-[empty]:sm:my-0 data-[empty]:sm:border-0 data-[empty]:sm:bg-transparent data-[empty]:sm:p-0"
            {...(tab === TabIds.Empty && { "data-empty": true })}
          >
            <h1 className="my-4 hidden text-center text-xl/tight font-light group-data-[empty]:mb-10 group-data-[empty]:block sm:mb-6 sm:text-3xl group-data-[empty]:sm:mb-6 lg:my-6 lg:text-5xl">
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
                allowStaking={enableGovernance}
              />
            </TabPanel>
          </Tabs>
        ) : (
          <Governance
            api={api}
            currentEpoch={currentEpoch}
            availableToStake={availableToStakeGovernance}
            warmup={governance.warmup}
            staked={governance.staked}
            cooldown={governance.cooldown}
            cooldown2={governance.cooldown2}
            allowStaking={enableGovernance}
          />
        )}
      </main>
      <Disclosure />
    </>
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
    [publishers, field],
  );

// eslint-disable-next-line unicorn/no-array-reduce, unicorn/prefer-math-min-max
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
      "group/tab flex flex-1 cursor-pointer flex-col items-center bg-pythpurple-800 data-[selected]:cursor-default focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 group-data-[empty]:sm:bg-transparent",
      className,
    )}
    {...props}
  >
    <div className="grid size-full flex-none basis-0 place-content-center border border-neutral-600/50 bg-pythpurple-800 p-2 text-center font-semibold transition group-hover/tab:bg-pythpurple-600/30 group-data-[selected]/tab:border-pythpurple-400/60 group-data-[selected]/tab:bg-pythpurple-600/60 group-data-[empty]:py-8 group-hover/tab:group-data-[selected]/tab:bg-pythpurple-600/60 sm:py-4 sm:text-lg group-data-[empty]:sm:py-2">
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

const Disclosure = () => {
  const hasAcknowledgedLegal = useLocalStorageValue("has-acknowledged-legal");
  const [understood, setUnderstood] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const acknowledge = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (understood && agreed) {
        hasAcknowledgedLegal.set("true");
      }
    },
    [hasAcknowledgedLegal, understood, agreed],
  );

  return (
    <ModalDialog
      title="Legal Notice - Local Restrictions"
      isOpen={hasAcknowledgedLegal.value === null}
      noClose
    >
      <Form onSubmit={acknowledge}>
        <p className="max-w-prose text-sm opacity-60">
          THE SERVICES ARE NOT OFFERED TO PERSONS OR ENTITIES WHO RESIDE IN, ARE
          CITIZENS OF, ARE LOCATED IN, ARE INCORPORATED IN, OR HAVE A REGISTERED
          OFFICE OR PRINCIPAL PLACE OF BUSINESS IN ANY RESTRICTED JURISDICTION
          OR COUNTRY SUBJECT TO ANY SANCTIONS OR RESTRICTIONS PURSUANT TO ANY
          APPLICABLE LAW, INCLUDING CUBA, DEMOCRATIC PEOPLE’S REPUBLIC OF KOREA
          (NORTH KOREA), IRAN, MYANMAR (BURMA), SYRIA, THE CRIMEA, DONETSK,
          KHERSON, LUHANSK, SEVASTOPOL, AND ZAPORIZHZHIA REGIONS, OR ANY OTHER
          COUNTRY OR REGION TO WHICH THE UNITED STATES, THE UNITED KINGDOM, THE
          EUROPEAN UNION, SWITZERLAND OR ANY OTHER JURISDICTIONS EMBARGOES GOODS
          OR IMPOSES SIMILAR SANCTIONS, INCLUDING THOSE LISTED ON OUR SERVICES
          (COLLECTIVELY, THE “<strong>RESTRICTED JURISDICTIONS</strong>” AND
          EACH A “<strong>RESTRICTED JURISDICTION</strong>”) OR ANY PERSON
          OWNED, CONTROLLED, LOCATED IN OR ORGANIZED UNDER THE LAWS OF ANY
          JURISDICTION UNDER EMBARGO OR CONNECTED OR AFFILIATED WITH ANY SUCH
          PERSON (COLLECTIVELY, “<strong>RESTRICTED PERSONS</strong>”). THE
          SERVICES WERE NOT SPECIFICALLY DEVELOPED FOR, AND ARE NOT AIMED AT OR
          BEING ACTIVELY MARKETED TO, PERSONS OR ENTITIES WHO RESIDE IN, ARE
          LOCATED IN, ARE INCORPORATED IN, OR HAVE A REGISTERED OFFICE OR
          PRINCIPAL PLACE OF BUSINESS IN THE EUROPEAN UNION. THERE ARE NO
          EXCEPTIONS. IF YOU ARE A RESTRICTED PERSON, THEN DO NOT USE OR ATTEMPT
          TO ACCESS AND/OR USE THE SERVICES. USE OF ANY TECHNOLOGY OR MECHANISM,
          SUCH AS A VIRTUAL PRIVATE NETWORK (“ <strong>VPN</strong>”) TO
          CIRCUMVENT THE RESTRICTIONS SET FORTH HEREIN IS PROHIBITED.
        </p>
        <Checkbox
          className="my-4 block max-w-prose"
          isSelected={understood}
          onChange={setUnderstood}
        >
          I understand
        </Checkbox>
        <Checkbox
          className="my-4 block max-w-prose"
          isSelected={agreed}
          onChange={setAgreed}
        >
          By checking the box and access the Services, you acknowledge and agree
          to the terms and conditions of our{" "}
          <Link
            href="https://www.pyth.network/terms-of-use"
            target="_blank"
            className="underline"
          >
            Terms of Use
          </Link>{" "}
          ,{" "}
          <Link
            href="https://www.pyth.network/privacy-policy"
            target="_blank"
            className="underline"
          >
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/terms-of-service" className="underline">
            Terms of Service
          </Link>
          .
        </Checkbox>
        <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
          <LinkButton
            className="w-full sm:w-auto"
            href="https://pyth.network/"
            variant="secondary"
            size="noshrink"
          >
            Exit
          </LinkButton>
          <Button
            className="w-full sm:w-auto"
            size="noshrink"
            type="submit"
            isDisabled={!understood || !agreed}
          >
            Confirm
          </Button>
        </div>
      </Form>
    </ModalDialog>
  );
};

import clsx from "clsx";
import { useMemo, useCallback } from "react";

import {
  type Context,
  delegateIntegrityStaking,
  cancelWarmupIntegrityStaking,
  unstakeIntegrityStaking,
  calculateApy,
} from "../../api";
import { ProgramSection } from "../ProgramSection";
import { SparkChart } from "../SparkChart";
import { StakingTimeline } from "../StakingTimeline";
import { Styled } from "../Styled";
import { Tokens } from "../Tokens";
import { AmountType, TransferButton } from "../TransferButton";

type Props = {
  availableToStake: bigint;
  locked: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  publishers: PublisherProps["publisher"][];
};

export const OracleIntegrityStaking = ({
  availableToStake,
  locked,
  warmup,
  staked,
  cooldown,
  cooldown2,
  publishers,
}: Props) => {
  const self = useMemo(
    () => publishers.find((publisher) => publisher.isSelf),
    [publishers],
  );

  const otherPublishers = useMemo(
    () => publishers.filter((publisher) => !publisher.isSelf),
    [publishers],
  );

  return (
    <ProgramSection
      name="Oracle Integrity Staking (OIS)"
      description="Protect DeFi"
      className="pb-0 sm:pb-0"
      available={availableToStake}
      warmup={warmup}
      staked={staked}
      cooldown={cooldown}
      cooldown2={cooldown2}
      {...(locked > 0n && {
        availableToStakeDetails: (
          <div className="mt-2 text-xs text-red-600">
            <Tokens>{locked}</Tokens> are locked and cannot be staked in OIS
          </div>
        ),
      })}
    >
      {self && (
        <div className="relative -mx-4 mt-6 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-10 sm:mt-10">
          <div className="relative w-full overflow-x-auto">
            <h3 className="sticky left-0 mb-4 pl-4 text-2xl font-light sm:pb-4 sm:pl-10 sm:pt-6">
              You ({self.name})
            </h3>

            <table className="mx-auto border border-neutral-600/50 text-sm">
              <thead className="bg-pythpurple-400/30 font-light">
                <tr>
                  <PublisherTableHeader>Pool</PublisherTableHeader>
                  <PublisherTableHeader>Last epoch APY</PublisherTableHeader>
                  <PublisherTableHeader>Historical APY</PublisherTableHeader>
                  <PublisherTableHeader>Number of feeds</PublisherTableHeader>
                  <PublisherTableHeader>Quality ranking</PublisherTableHeader>
                  {availableToStake > 0n && <PublisherTableHeader />}
                </tr>
              </thead>
              <tbody className="bg-pythpurple-400/10">
                <Publisher
                  isSelf
                  availableToStake={availableToStake}
                  publisher={self}
                  totalStaked={staked}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div
        className={clsx(
          "relative -mx-4 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-10 lg:mt-10",
          { "mt-6": self === undefined },
        )}
      >
        <div className="relative w-full overflow-x-auto">
          <h3 className="sticky left-0 mb-4 pl-4 text-2xl font-light sm:pb-4 sm:pl-10 sm:pt-6">
            {self ? "Other Publishers" : "Publishers"}
          </h3>

          <table className="min-w-full text-sm">
            <thead className="bg-pythpurple-100/30 font-light">
              <tr>
                <PublisherTableHeader className="pl-4 text-left sm:pl-10">
                  Publisher
                </PublisherTableHeader>
                <PublisherTableHeader>Self stake</PublisherTableHeader>
                <PublisherTableHeader>Pool</PublisherTableHeader>
                <PublisherTableHeader>Last epoch APY</PublisherTableHeader>
                <PublisherTableHeader>Historical APY</PublisherTableHeader>
                <PublisherTableHeader>Number of feeds</PublisherTableHeader>
                <PublisherTableHeader
                  className={clsx({ "pr-4 sm:pr-10": availableToStake <= 0n })}
                >
                  Quality ranking
                </PublisherTableHeader>
                {availableToStake > 0n && (
                  <PublisherTableHeader className="pr-4 sm:pr-10" />
                )}
              </tr>
            </thead>
            <tbody className="bg-white/5">
              {otherPublishers.map((publisher) => (
                <Publisher
                  key={publisher.publicKey}
                  availableToStake={availableToStake}
                  publisher={publisher}
                  totalStaked={staked}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProgramSection>
  );
};

const PublisherTableHeader = Styled(
  "th",
  "py-2 font-normal px-5 whitespace-nowrap",
);

type PublisherProps = {
  availableToStake: bigint;
  totalStaked: bigint;
  isSelf?: boolean;
  publisher: {
    name: string;
    publicKey: string;
    isSelf: boolean;
    selfStake: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    numFeeds: number;
    qualityRanking: number;
    apyHistory: { date: Date; apy: number }[];
    positions?:
      | {
          warmup?: bigint | undefined;
          staked?: bigint | undefined;
          cooldown?: bigint | undefined;
          cooldown2?: bigint | undefined;
        }
      | undefined;
  };
};

const Publisher = ({
  publisher,
  availableToStake,
  totalStaked,
  isSelf,
}: PublisherProps) => {
  const warmup = useMemo(
    () =>
      publisher.positions?.warmup !== undefined &&
      publisher.positions.warmup > 0n
        ? publisher.positions.warmup
        : undefined,
    [publisher.positions?.warmup],
  );
  const staked = useMemo(
    () =>
      publisher.positions?.staked !== undefined &&
      publisher.positions.staked > 0n
        ? publisher.positions.staked
        : undefined,
    [publisher.positions?.staked],
  );

  const cancelWarmup = useTransferActionForPublisher(
    cancelWarmupIntegrityStaking,
    publisher.publicKey,
  );
  const unstake = useTransferActionForPublisher(
    unstakeIntegrityStaking,
    publisher.publicKey,
  );
  const utilizationPercent = useMemo(
    () => Number((100n * publisher.poolUtilization) / publisher.poolCapacity),
    [publisher.poolUtilization, publisher.poolCapacity],
  );

  return (
    <>
      <tr className="border-t border-neutral-600/50 first:border-0">
        {!isSelf && (
          <>
            <PublisherTableCell className="py-4 pl-4 font-medium sm:pl-10">
              {publisher.name}
            </PublisherTableCell>
            <PublisherTableCell className="text-center">
              <Tokens>{publisher.selfStake}</Tokens>
            </PublisherTableCell>
          </>
        )}
        <PublisherTableCell className="text-center">
          <div className="relative mx-auto grid h-5 w-52 place-content-center border border-black bg-pythpurple-600/50">
            <div
              style={{
                width: `${utilizationPercent.toString()}%`,
              }}
              className={clsx(
                "absolute inset-0 max-w-full",
                publisher.poolUtilization > publisher.poolCapacity
                  ? "bg-fuchsia-900"
                  : "bg-pythpurple-400",
              )}
            />
            <div
              className={clsx("isolate text-sm font-medium", {
                "mix-blend-difference":
                  publisher.poolUtilization <= publisher.poolCapacity,
              })}
            >
              {utilizationPercent.toString()}%
            </div>
          </div>
          <div className="mt-2 flex flex-row items-center justify-center gap-1 text-sm">
            <span>
              <Tokens>{publisher.poolUtilization}</Tokens>
            </span>
            <span>/</span>
            <span>
              <Tokens>{publisher.poolCapacity}</Tokens>
            </span>
          </div>
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          <div>
            {calculateApy(
              publisher.poolCapacity,
              publisher.poolUtilization,
              publisher.isSelf,
            )}
            %
          </div>
        </PublisherTableCell>
        <PublisherTableCell>
          <div className="mx-auto h-14 w-28">
            <SparkChart
              data={publisher.apyHistory.map(({ date, apy }) => ({
                date,
                value: apy,
              }))}
            />
          </div>
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          {publisher.numFeeds}
        </PublisherTableCell>
        <PublisherTableCell
          className={clsx("text-center", {
            "pr-4 sm:pr-10": availableToStake <= 0n && !isSelf,
          })}
        >
          {publisher.qualityRanking}
        </PublisherTableCell>
        {availableToStake > 0 && (
          <PublisherTableCell
            className={clsx("text-right", { "pr-4 sm:pr-10": !isSelf })}
          >
            <StakeToPublisherButton
              availableToStake={availableToStake}
              poolCapacity={publisher.poolCapacity}
              poolUtilization={publisher.poolUtilization}
              publisherKey={publisher.publicKey}
              publisherName={publisher.name}
              isSelf={publisher.isSelf}
            />
          </PublisherTableCell>
        )}
      </tr>
      {(warmup !== undefined || staked !== undefined) && (
        <tr>
          <td colSpan={8} className="border-separate border-spacing-8">
            <div className="mx-auto mb-8 mt-4 w-[30rem] border border-neutral-600/50 bg-pythpurple-800 px-8 py-6">
              <table className="w-full">
                <caption className="mb-2 text-left text-lg font-light">
                  Your Positions
                </caption>
                <tbody>
                  {warmup !== undefined && (
                    <tr>
                      <td className="opacity-80">Warmup</td>
                      <td className="px-4">
                        <Tokens>{warmup}</Tokens>
                      </td>
                      <td
                        className={clsx("text-right", {
                          "pb-2": staked !== undefined,
                        })}
                      >
                        <TransferButton
                          small
                          secondary
                          className="w-28"
                          actionDescription={`Cancel tokens that are in warmup for staking to ${publisher.name}`}
                          actionName="Cancel"
                          submitButtonText="Cancel Warmup"
                          title="Cancel Warmup"
                          max={warmup}
                          transfer={cancelWarmup}
                        />
                      </td>
                    </tr>
                  )}
                  {staked !== undefined && (
                    <tr>
                      <td className="opacity-80">Staked</td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <Tokens>{staked}</Tokens>
                          <div className="text-xs opacity-60">
                            ({Number((100n * staked) / totalStaked)}% of your
                            staked tokens)
                          </div>
                        </div>
                      </td>
                      <td className="py-0.5 text-right">
                        <TransferButton
                          small
                          secondary
                          className="w-28"
                          actionDescription={`Unstake tokens from ${publisher.name}`}
                          actionName="Unstake"
                          max={staked}
                          transfer={unstake}
                        >
                          <StakingTimeline cooldownOnly />
                        </TransferButton>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const PublisherTableCell = Styled("td", "py-4 px-5 whitespace-nowrap");

type StakeToPublisherButtonProps = {
  publisherName: string;
  publisherKey: string;
  availableToStake: bigint;
  poolCapacity: bigint;
  poolUtilization: bigint;
  isSelf: boolean;
};

const StakeToPublisherButton = ({
  publisherName,
  publisherKey,
  poolCapacity,
  poolUtilization,
  availableToStake,
  isSelf,
}: StakeToPublisherButtonProps) => {
  const delegate = useTransferActionForPublisher(
    delegateIntegrityStaking,
    publisherKey,
  );

  return (
    <TransferButton
      small
      actionDescription={`Stake to ${publisherName}`}
      actionName="Stake"
      max={availableToStake}
      transfer={delegate}
    >
      {(amount) => (
        <>
          <div className="mb-8 flex flex-row items-center justify-between text-sm">
            <div>APY after staking</div>
            <div className="font-medium">
              {calculateApy(
                poolCapacity,
                poolUtilization +
                  (amount.type === AmountType.Valid ? amount.amount : 0n),
                isSelf,
              )}
              %
            </div>
          </div>
          <StakingTimeline />
        </>
      )}
    </TransferButton>
  );
};

const useTransferActionForPublisher = (
  action: (
    context: Context,
    publicKey: string,
    amount: bigint,
  ) => Promise<void>,
  publicKey: string,
) =>
  useCallback(
    (context: Context, amount: bigint) => action(context, publicKey, amount),
    [action, publicKey],
  );

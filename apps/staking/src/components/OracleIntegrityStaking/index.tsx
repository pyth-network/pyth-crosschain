import clsx from "clsx";
import { useMemo, useCallback } from "react";

import {
  type Context,
  delegateIntegrityStaking,
  cancelWarmupIntegrityStaking,
  unstakeIntegrityStaking,
  calculateApy,
} from "../../api";
import { PositionFlowchart } from "../PositionFlowchart";
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
      name="Oracle Integrity Staking"
      description="Protect DeFi, Earn Yield"
      className="pb-0"
      positions={{
        locked,
        available: availableToStake,
        warmup,
        staked,
        cooldown,
        cooldown2,
        className: "mb-8",
      }}
    >
      {self && (
        <div className="-mx-10 border-t border-neutral-600/50 py-16">
          <table className="mx-auto border border-neutral-600/50 text-sm">
            <caption className="mb-4 ml-10 text-2xl font-light">
              You ({self.name})
            </caption>
            <thead className="bg-pythpurple-400/30 font-light">
              <tr>
                <PublisherTableHeader>Pool</PublisherTableHeader>
                <PublisherTableHeader>APY</PublisherTableHeader>
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
              />
            </tbody>
          </table>
        </div>
      )}
      <div className="-mx-10 border-t border-neutral-600/50 pt-4">
        <table className="w-full text-sm">
          <caption className="mb-4 ml-10 text-left text-2xl font-light">
            {self ? "Other Publishers" : "Publishers"}
          </caption>
          <thead className="bg-pythpurple-100/30 font-light">
            <tr>
              <PublisherTableHeader className="pl-10 text-left">
                Publisher
              </PublisherTableHeader>
              <PublisherTableHeader>Self stake</PublisherTableHeader>
              <PublisherTableHeader>Pool</PublisherTableHeader>
              <PublisherTableHeader>APY</PublisherTableHeader>
              <PublisherTableHeader>Historical APY</PublisherTableHeader>
              <PublisherTableHeader>Number of feeds</PublisherTableHeader>
              <PublisherTableHeader
                className={clsx({ "pr-10": availableToStake <= 0n })}
              >
                Quality ranking
              </PublisherTableHeader>
              {availableToStake > 0n && (
                <PublisherTableHeader className="pr-10" />
              )}
            </tr>
          </thead>
          <tbody className="bg-white/5">
            {otherPublishers.map((publisher) => (
              <Publisher
                key={publisher.publicKey}
                availableToStake={availableToStake}
                publisher={publisher}
              />
            ))}
          </tbody>
        </table>
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

const Publisher = ({ publisher, availableToStake, isSelf }: PublisherProps) => {
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
            <PublisherTableCell className="py-4 pl-10 font-medium">
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
            "pr-10": availableToStake <= 0n && !isSelf,
          })}
        >
          {publisher.qualityRanking}
        </PublisherTableCell>
        {availableToStake > 0 && (
          <PublisherTableCell
            className={clsx("text-right", { "pr-10": !isSelf })}
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
      {publisher.positions && (
        <tr>
          <td colSpan={8} className="border-separate border-spacing-8">
            <div className="mx-auto w-full px-20 pb-8">
              <PositionFlowchart
                small
                className="mx-auto w-[56rem]"
                warmup={publisher.positions.warmup ?? 0n}
                staked={publisher.positions.staked ?? 0n}
                cooldown={publisher.positions.cooldown ?? 0n}
                cooldown2={publisher.positions.cooldown2 ?? 0n}
                cancelWarmup={cancelWarmup}
                cancelWarmupDescription={`Cancel tokens that are in warmup for staking to ${publisher.name}`}
                unstake={unstake}
                unstakeDescription={`Unstake tokens from ${publisher.name}`}
              />
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

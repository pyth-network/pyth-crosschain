import clsx from "clsx";
import { type ReactNode, useMemo, useCallback } from "react";

import { SparkChart } from "./spark-chart";
import {
  deposit,
  withdraw,
  stakeGovernance,
  cancelWarmupGovernance,
  unstakeGovernance,
  delegateIntegrityStaking,
  cancelWarmupIntegrityStaking,
  unstakeIntegrityStaking,
  claim,
  calculateApy,
} from "../../api";
import type { Context } from "../../use-api-context";
import { StateType, useTransfer } from "../../use-transfer";
import { Button } from "../Button";
import { ModalButton } from "../ModalButton";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

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
  integrityStakingPublishers: PublisherProps["publisher"][];
};

export const DashboardLoaded = ({
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

  const self = useMemo(
    () => integrityStakingPublishers.find((publisher) => publisher.isSelf),
    [integrityStakingPublishers],
  );

  const otherPublishers = useMemo(
    () => integrityStakingPublishers.filter((publisher) => !publisher.isSelf),
    [integrityStakingPublishers],
  );

  return (
    <>
      <div className="flex w-full flex-col gap-8 bg-pythpurple-100 p-8">
        <div className="flex flex-row gap-16">
          <BalanceCategory
            name="Total balance"
            actions={
              <TransferButton
                actionDescription="Add funds to your balance"
                actionName="Deposit"
                max={walletAmount}
                transfer={deposit}
              >
                <strong>In wallet:</strong> <Tokens>{walletAmount}</Tokens>
              </TransferButton>
            }
            {...(lastSlash && {
              disclaimer: (
                <>
                  <Tokens>{lastSlash.amount}</Tokens> were slashed on{" "}
                  {lastSlash.date.toLocaleString()}
                </>
              ),
            })}
          >
            {total}
          </BalanceCategory>
          <BalanceCategory
            name="Available to withdraw"
            description="The lesser of the amount you have available to stake in governance & integrity staking"
            {...(availableToWithdraw > 0 && {
              actions:
                availableRewards > 0 ? (
                  <ClaimRequiredButton
                    buttonText="Withdraw"
                    description="Before you can withdraw tokens, you must claim your unclaimed rewards"
                    availableRewards={availableRewards}
                  />
                ) : (
                  <TransferButton
                    actionDescription="Move funds from your account back to your wallet"
                    actionName="Withdraw"
                    max={availableToWithdraw}
                    transfer={withdraw}
                  >
                    <strong>Available to withdraw:</strong>{" "}
                    <Tokens>{availableToWithdraw}</Tokens>
                  </TransferButton>
                ),
            })}
          >
            {availableToWithdraw}
          </BalanceCategory>
          <BalanceCategory
            name="Available rewards"
            description="Rewards you have earned but not yet claimed from the Integrity Staking program."
            {...(expiringRewards.amount > 0n && {
              disclaimer: (
                <>
                  <Tokens>{expiringRewards.amount}</Tokens> will expire on{" "}
                  {expiringRewards.expiry.toLocaleString()} if you have not
                  claimed before then
                </>
              ),
            })}
            {...(availableRewards > 0 && {
              actions: <ClaimButton />,
            })}
          >
            {availableRewards}
          </BalanceCategory>
          {locked && (
            <BalanceCategory
              name="Locked tokens"
              description="Locked tokens cannot be withdrawn to your wallet and cannot participate in Integrity Staking."
              actions={
                <ModalButton
                  title="Unlock Schedule"
                  buttonContent="Show Unlock Schedule"
                  description="Your tokens will become available for withdrawal and for participation in Integrity Staking according to this schedule"
                >
                  <table>
                    <thead className="font-medium">
                      <tr>
                        <td>Date</td>
                        <td>Amount</td>
                      </tr>
                    </thead>
                    <tbody>
                      {unlockSchedule.map((unlock, i) => (
                        <tr key={i}>
                          <td className="pr-4">
                            {unlock.date.toLocaleString()}
                          </td>
                          <td>
                            <Tokens>{unlock.amount}</Tokens>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ModalButton>
              }
            >
              {locked}
            </BalanceCategory>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-between gap-8">
          <section className="bg-black/10 p-4">
            <h2 className="text-2xl font-semibold">Governance</h2>
            <p>Vote and Influence the Network</p>
            <div className="mt-2 flex flex-row items-stretch justify-center">
              <Position
                className="bg-pythpurple-600/10"
                name="Available to Stake"
                actions={
                  <TransferButton
                    actionDescription="Stake funds to participate in governance votes"
                    actionName="Stake"
                    max={availableToStakeGovernance}
                    transfer={stakeGovernance}
                  >
                    <strong>Available to stake:</strong>{" "}
                    <Tokens>{availableToStakeGovernance}</Tokens>
                  </TransferButton>
                }
              >
                {availableToStakeGovernance}
              </Position>
              <Position
                className="bg-pythpurple-600/15"
                name="Warmup"
                actions={
                  <TransferButton
                    actionDescription="Cancel staking tokens for governance that are currently in warmup"
                    actionName="Cancel"
                    submitButtonText="Cancel Warmup"
                    title="Cancel Governance Staking"
                    max={governance.warmup}
                    transfer={cancelWarmupGovernance}
                  >
                    <strong>Max:</strong> <Tokens>{governance.warmup}</Tokens>
                  </TransferButton>
                }
                details={
                  <div className="text-xs">Staking 2024-08-01T00:00Z</div>
                }
              >
                {governance.warmup}
              </Position>
              <Position
                className="bg-pythpurple-600/20"
                name="Staked"
                actions={
                  <TransferButton
                    actionDescription="Unstake tokens from the Governance program"
                    actionName="Unstake"
                    title="Unstake From Governance"
                    max={governance.staked}
                    transfer={unstakeGovernance}
                  >
                    <strong>Max:</strong> <Tokens>{governance.staked}</Tokens>
                  </TransferButton>
                }
              >
                {governance.staked}
              </Position>
              <Position
                className="bg-pythpurple-600/25"
                name="Cooldown (next epoch)"
                details={<div className="text-xs">End 2024-08-01T00:00Z</div>}
              >
                {governance.cooldown}
              </Position>
              <Position
                className="bg-pythpurple-600/30"
                name="Cooldown (this epoch)"
                details={<div className="text-xs">End 2024-08-08T00:00Z</div>}
              >
                {governance.cooldown2}
              </Position>
            </div>
          </section>
          <section className="bg-black/10 p-4">
            <h2 className="text-2xl font-semibold">Integrity Staking</h2>
            <p>Protect DeFi, Earn Yield</p>
            <div className="mt-2 flex flex-row items-stretch justify-center">
              <Position className="bg-pythpurple-600/5" name="Locked">
                {locked}
              </Position>
              <Position
                className="bg-pythpurple-600/10"
                name="Available to Stake"
              >
                {availableToStakeIntegrity}
              </Position>
              <Position
                className="bg-pythpurple-600/15"
                name="Warmup"
                details={
                  <div className="text-xs">Staking 2024-08-01T00:00Z</div>
                }
              >
                {integrityStakingWarmup}
              </Position>
              <Position className="bg-pythpurple-600/20" name="Staked">
                {integrityStakingStaked}
              </Position>
              <Position
                className="bg-pythpurple-600/25"
                name="Cooldown (next epoch)"
                details={<div className="text-xs">End 2024-08-01T00:00Z</div>}
              >
                {integrityStakingCooldown}
              </Position>
              <Position
                className="bg-pythpurple-600/30"
                name="Cooldown (this epoch)"
                details={<div className="text-xs">End 2024-08-08T00:00Z</div>}
              >
                {integrityStakingCooldown2}
              </Position>
            </div>
            {self && (
              <div className="mt-8 bg-black/5 p-4">
                <table className="w-full text-left">
                  <caption className="mb-4 text-left text-xl">
                    You ({self.name})
                  </caption>
                  <thead>
                    <tr>
                      <th className="text-center">Pool</th>
                      <th className="text-center">Historical APY</th>
                      <th>Number of feeds</th>
                      <th>Quality ranking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Publisher
                      availableToStake={availableToStakeIntegrity}
                      availableRewards={availableRewards}
                      publisher={self}
                      omitName
                      omitSelfStake
                    />
                  </tbody>
                </table>
              </div>
            )}
            <table className="mt-8 w-full text-left">
              <caption className="mb-4 text-left text-xl">
                {self ? "Other Publishers" : "Publishers"}
              </caption>
              <thead>
                <tr>
                  <th>Publisher</th>
                  <th>Self stake</th>
                  <th className="text-center">Pool</th>
                  <th className="text-center">Historical APY</th>
                  <th>Number of feeds</th>
                  <th>Quality ranking</th>
                </tr>
              </thead>
              <tbody>
                {otherPublishers.map((publisher) => (
                  <Publisher
                    key={publisher.publicKey}
                    availableToStake={availableToStakeIntegrity}
                    availableRewards={availableRewards}
                    publisher={publisher}
                  />
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    publishers.map((publisher) => publisher.positions?.[field]),
  );

type BalanceCategoryProps = {
  children: bigint;
  name: ReactNode | ReactNode[];
  description?: ReactNode | ReactNode[] | undefined;
  disclaimer?: ReactNode | ReactNode[] | undefined;
  actions?: ReactNode | ReactNode[];
};

const BalanceCategory = ({
  children,
  name,
  description,
  disclaimer,
  actions,
}: BalanceCategoryProps) => (
  <div className="flex w-1/3 flex-col items-start justify-between gap-2">
    <div>
      <div className="text-4xl font-semibold">
        <Tokens>{children}</Tokens>
      </div>
      <div className="flex items-center text-lg">{name}</div>
      {description && (
        <p className="max-w-xs text-xs font-light">{description}</p>
      )}
      {disclaimer && (
        <p className="mt-2 max-w-xs text-sm font-medium text-red-600">
          {disclaimer}
        </p>
      )}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);

type PositionProps = {
  name: string;
  className?: string | undefined;
  children: bigint;
  actions?: ReactNode | ReactNode[];
  details?: ReactNode;
};

const Position = ({
  name,
  details,
  className,
  children,
  actions,
}: PositionProps) =>
  children > 0n && (
    <div
      // style={{ width: `${100 * tokens / tokenData.total}%` }}
      className={clsx(
        "flex w-full flex-col justify-between gap-2 overflow-hidden p-2",
        className,
      )}
    >
      <div>
        <div className="text-sm font-bold">{name}</div>
        <div className="text-sm">
          <Tokens>{children}</Tokens>
        </div>
        {details}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );

type PublisherProps = {
  availableRewards: bigint;
  availableToStake: bigint;
  omitName?: boolean;
  omitSelfStake?: boolean;
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
  availableRewards,
  publisher,
  availableToStake,
  omitName,
  omitSelfStake,
}: PublisherProps) => {
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
      <tr>
        {!omitName && <td className="py-4">{publisher.name}</td>}
        {!omitSelfStake && (
          <td>
            <Tokens>{publisher.selfStake}</Tokens>
          </td>
        )}
        <td className="flex flex-row items-center justify-center gap-2 py-4">
          <div className="relative grid h-8 w-60 place-content-center border border-black bg-pythpurple-600/10">
            <div
              style={{
                width: `${utilizationPercent.toString()}%`,
              }}
              className={clsx(
                "absolute inset-0 max-w-full",
                publisher.poolUtilization > publisher.poolCapacity
                  ? "bg-red-500"
                  : "bg-pythpurple-400",
              )}
            />
            <div
              className={clsx(
                "isolate flex flex-row items-center justify-center gap-1 text-sm",
                {
                  "text-white":
                    publisher.poolUtilization > publisher.poolCapacity,
                },
              )}
            >
              <span>
                <Tokens>{publisher.poolUtilization}</Tokens>
              </span>
              <span>/</span>
              <span>
                <Tokens>{publisher.poolCapacity}</Tokens>
              </span>
              <span>({utilizationPercent.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="flex flex-row items-center gap-1">
            <div className="font-medium">APY:</div>
            <div>
              {calculateApy(
                publisher.poolCapacity,
                publisher.poolUtilization,
                publisher.isSelf,
              )}
              %
            </div>
          </div>
        </td>
        <td className="px-4">
          <div className="mx-auto h-14 w-28 border border-black bg-white/40">
            <SparkChart
              data={publisher.apyHistory.map(({ date, apy }) => ({
                date,
                value: apy,
              }))}
            />
          </div>
        </td>
        <td>{publisher.numFeeds}</td>
        <td>{publisher.qualityRanking}</td>
        {availableToStake > 0 && (
          <td>
            <StakeToPublisherButton
              availableToStake={availableToStake}
              poolCapacity={publisher.poolCapacity}
              poolUtilization={publisher.poolUtilization}
              publisherKey={publisher.publicKey}
              publisherName={publisher.name}
              isSelf={publisher.isSelf}
            />
          </td>
        )}
      </tr>
      {publisher.positions && (
        <tr className="group">
          <td colSpan={6} className="border-separate border-spacing-8">
            <div className="mx-auto mb-8 w-fit bg-black/5 p-4 group-last:mb-0">
              <table className="w-full">
                <caption className="mb-2 text-left text-xl">
                  Your Positions
                </caption>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <PublisherPosition
                    name="Warmup"
                    actions={
                      <TransferButton
                        actionDescription={`Cancel tokens that are in warmup for staking to ${publisher.name}`}
                        actionName="Cancel"
                        submitButtonText="Cancel Warmup"
                        title="Cancel Staking"
                        max={publisher.positions.warmup ?? 0n}
                        transfer={cancelWarmup}
                      >
                        <strong>Max:</strong>{" "}
                        <Tokens>{publisher.positions.warmup ?? 0n}</Tokens>
                      </TransferButton>
                    }
                  >
                    {publisher.positions.warmup}
                  </PublisherPosition>
                  <PublisherPosition
                    name="Staked"
                    actions={
                      availableRewards > 0 ? (
                        <ClaimRequiredButton
                          buttonText="Unstake"
                          description={`Before you can unstake tokens from ${publisher.name}, you must claim your unclaimed rewards`}
                          availableRewards={availableRewards}
                        />
                      ) : (
                        <TransferButton
                          actionDescription={`Unstake tokens from ${publisher.name}`}
                          actionName="Unstake"
                          title="Unstake"
                          max={publisher.positions.staked ?? 0n}
                          transfer={unstake}
                        >
                          <strong>Max:</strong>{" "}
                          <Tokens>{publisher.positions.staked ?? 0n}</Tokens>
                        </TransferButton>
                      )
                    }
                  >
                    {publisher.positions.staked}
                  </PublisherPosition>
                  <PublisherPosition name="Cooldown (this epoch)">
                    {publisher.positions.cooldown}
                  </PublisherPosition>
                  <PublisherPosition name="Cooldown (next epoch)">
                    {publisher.positions.cooldown2}
                  </PublisherPosition>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

type PublisherPositionProps = {
  name: string;
  children: bigint | undefined;
  actions?: ReactNode | ReactNode[];
};

const PublisherPosition = ({
  children,
  name,
  actions,
}: PublisherPositionProps) =>
  children &&
  children !== 0n && (
    <tr>
      <td className="pr-8">{name}</td>
      <td className="pr-8">
        <Tokens>{children}</Tokens>
      </td>
      {actions && <td>{actions}</td>}
    </tr>
  );

// eslint-disable-next-line unicorn/no-array-reduce
const bigIntMin = (...args: bigint[]) => args.reduce((m, e) => (e < m ? e : m));

const ClaimButton = () => {
  const { state, execute } = useTransfer(claim);

  return (
    <Button
      onClick={execute}
      disabled={state.type !== StateType.Base}
      loading={state.type === StateType.Submitting}
    >
      Claim
    </Button>
  );
};

type ClaimRequiredButtonProps = {
  buttonText: string;
  description: string;
  availableRewards: bigint;
};

const ClaimRequiredButton = ({
  buttonText,
  description,
  availableRewards,
}: ClaimRequiredButtonProps) => {
  const { state, execute } = useTransfer(claim);

  const isSubmitting = state.type === StateType.Submitting;

  return (
    <ModalButton
      buttonContent={buttonText}
      title="Claim Required"
      closeDisabled={isSubmitting}
      additionalButtons={(close) => (
        <Button
          onClick={() => execute().then(close)}
          disabled={state.type !== StateType.Base}
          loading={isSubmitting}
        >
          Claim
        </Button>
      )}
      description={description}
    >
      <div>
        <strong>Available Rewards:</strong> <Tokens>{availableRewards}</Tokens>
      </div>
    </ModalButton>
  );
};

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
      actionDescription={`Stake to ${publisherName}`}
      actionName="Stake"
      max={availableToStake}
      transfer={delegate}
    >
      {(amount) => (
        <>
          <strong>Available to stake:</strong>{" "}
          <Tokens>{availableToStake}</Tokens>
          {amount !== undefined && (
            <div>
              Staking these tokens will change the APY to:{" "}
              {calculateApy(poolCapacity, poolUtilization + amount, isSelf)}%
            </div>
          )}
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

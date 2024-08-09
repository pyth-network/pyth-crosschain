import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import clsx from "clsx";
import { type ReactNode, useMemo, useCallback } from "react";

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
} from "../../api";
import { StateType, useTransfer } from "../../use-transfer";
import { Button } from "../Button";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = {
  replaceData: (newData: Omit<Props, "replaceData">) => void;
  total: bigint;
  walletAmount: bigint;
  availableRewards: bigint;
  locked: bigint;
  governance: {
    warmup: bigint;
    staked: bigint;
    cooldown: bigint;
    cooldown2: bigint;
  };
  integrityStakingPublishers: Omit<
    PublisherProps,
    "availableToStake" | "replaceData"
  >[];
};

export const DashboardLoaded = ({
  total,
  walletAmount,
  availableRewards,
  governance,
  integrityStakingPublishers,
  locked,
  replaceData,
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
                replaceData={replaceData}
                transfer={deposit}
              >
                <strong>In wallet:</strong> <Tokens>{walletAmount}</Tokens>
              </TransferButton>
            }
          >
            {total}
          </BalanceCategory>
          <BalanceCategory
            name="Available to withdraw"
            description="The lesser of the amount you have available to stake in governance & integrity staking"
            {...(availableToWithdraw > 0 && {
              actions: (
                <TransferButton
                  actionDescription="Move funds from your account back to your wallet"
                  actionName="Withdraw"
                  max={availableToWithdraw}
                  replaceData={replaceData}
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
            name="Claimable rewards"
            description="Rewards you have earned but not yet claimed from the Integrity Staking program"
            {...(availableRewards > 0 && {
              actions: <ClaimButton replaceData={replaceData} />,
            })}
          >
            {availableRewards}
          </BalanceCategory>
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
                    replaceData={replaceData}
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
                    replaceData={replaceData}
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
                    replaceData={replaceData}
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
            <table className="mt-8 w-full text-left">
              <caption className="mb-4 text-left text-xl">Publishers</caption>
              <thead>
                <tr>
                  <th>Publisher</th>
                  <th>Self stake</th>
                  <th className="text-center">Pool</th>
                  <th>Number of feeds</th>
                  <th>Quality ranking</th>
                </tr>
              </thead>
              <tbody>
                {integrityStakingPublishers.map((publisher) => (
                  <Publisher
                    key={publisher.publicKey}
                    availableToStake={availableToStakeIntegrity}
                    replaceData={replaceData}
                    {...publisher}
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
  name: string;
  description?: string | undefined;
  actions?: ReactNode | ReactNode[];
};

const BalanceCategory = ({
  children,
  name,
  description,
  actions,
}: BalanceCategoryProps) => (
  <div className="flex w-1/3 flex-col items-start justify-between gap-2">
    <div>
      <div className="text-4xl font-semibold">
        <Tokens>{children}</Tokens>
      </div>
      <div className="text-lg">{name}</div>
      {description && (
        <p className="max-w-xs text-xs font-light">{description}</p>
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
  availableToStake: bigint;
  replaceData: Props["replaceData"];
  name: string;
  publicKey: string;
  selfStake: bigint;
  poolCapacity: bigint;
  poolUtilization: bigint;
  apy: number;
  numFeeds: number;
  qualityRanking: number;
  positions?:
    | {
        warmup?: bigint | undefined;
        staked?: bigint | undefined;
        cooldown?: bigint | undefined;
        cooldown2?: bigint | undefined;
      }
    | undefined;
};

const Publisher = ({
  name,
  publicKey,
  selfStake,
  poolUtilization,
  poolCapacity,
  apy,
  numFeeds,
  qualityRanking,
  positions,
  availableToStake,
  replaceData,
}: PublisherProps) => {
  const delegate = useTransferActionForPublisher(
    delegateIntegrityStaking,
    publicKey,
  );
  const cancelWarmup = useTransferActionForPublisher(
    cancelWarmupIntegrityStaking,
    publicKey,
  );
  const unstake = useTransferActionForPublisher(
    unstakeIntegrityStaking,
    publicKey,
  );
  const utilizationPercent = useMemo(
    () => Number((100n * poolUtilization) / poolCapacity),
    [poolUtilization, poolCapacity],
  );

  return (
    <>
      <tr>
        <td className="py-4">{name}</td>
        <td>
          <Tokens>{selfStake}</Tokens>
        </td>
        <td className="flex flex-row items-center justify-center gap-2 py-4">
          <div className="relative grid h-8 w-60 place-content-center border border-black bg-pythpurple-600/10">
            <div
              style={{
                width: `${utilizationPercent.toString()}%`,
              }}
              className={clsx(
                "absolute inset-0 max-w-full",
                poolUtilization > poolCapacity
                  ? "bg-red-500"
                  : "bg-pythpurple-400",
              )}
            />
            <div
              className={clsx(
                "isolate flex flex-row items-center justify-center gap-1 text-sm",
                { "text-white": poolUtilization > poolCapacity },
              )}
            >
              <span>
                <Tokens>{poolUtilization}</Tokens>
              </span>
              <span>/</span>
              <span>
                <Tokens>{poolCapacity}</Tokens>
              </span>
              <span>({utilizationPercent.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="flex flex-row items-center gap-1">
            <div className="font-medium">APY:</div>
            <div>{apy}%</div>
          </div>
        </td>
        <td>{numFeeds}</td>
        <td>{qualityRanking}</td>
        {availableToStake > 0 && (
          <td>
            <TransferButton
              actionDescription={`Stake to ${name}`}
              actionName="Stake"
              max={availableToStake}
              replaceData={replaceData}
              transfer={delegate}
            >
              <strong>Available to stake:</strong>{" "}
              <Tokens>{availableToStake}</Tokens>
            </TransferButton>
          </td>
        )}
      </tr>
      {positions && (
        <tr>
          <td colSpan={6} className="border-separate border-spacing-8">
            <div className="mx-auto mb-8 w-fit bg-black/5 p-4">
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
                        actionDescription={`Cancel tokens that are in warmup for staking to ${name}`}
                        actionName="Cancel"
                        submitButtonText="Cancel Warmup"
                        title="Cancel Staking"
                        max={positions.warmup ?? 0n}
                        replaceData={replaceData}
                        transfer={cancelWarmup}
                      >
                        <strong>Max:</strong>{" "}
                        <Tokens>{positions.warmup ?? 0n}</Tokens>
                      </TransferButton>
                    }
                  >
                    {positions.warmup}
                  </PublisherPosition>
                  <PublisherPosition
                    name="Staked"
                    actions={
                      <TransferButton
                        actionDescription={`Unstake tokens from ${name}`}
                        actionName="Unstake"
                        title="Unstake"
                        max={positions.staked ?? 0n}
                        replaceData={replaceData}
                        transfer={unstake}
                      >
                        <strong>Max:</strong>{" "}
                        <Tokens>{positions.staked ?? 0n}</Tokens>
                      </TransferButton>
                    }
                  >
                    {positions.staked}
                  </PublisherPosition>
                  <PublisherPosition name="Cooldown (this epoch)">
                    {positions.cooldown}
                  </PublisherPosition>
                  <PublisherPosition name="Cooldown (next epoch)">
                    {positions.cooldown2}
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

const useTransferActionForPublisher = (
  action: (
    connection: Connection,
    wallet: WalletContextState,
    publicKey: string,
    amount: bigint,
  ) => Promise<void>,
  publicKey: string,
) =>
  useCallback(
    (connection: Connection, wallet: WalletContextState, amount: bigint) =>
      action(connection, wallet, publicKey, amount),
    [action, publicKey],
  );

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

type ClaimButtonProps = {
  replaceData: Props["replaceData"];
};

const ClaimButton = ({ replaceData }: ClaimButtonProps) => {
  const { state, execute } = useTransfer(claim, replaceData);

  return (
    <Button
      onClick={execute}
      disabled={state.type !== StateType.Base}
      loading={
        state.type === StateType.LoadingData ||
        state.type === StateType.Submitting
      }
    >
      Claim
    </Button>
  );
};

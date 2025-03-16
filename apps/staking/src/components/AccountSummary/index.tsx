import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { epochToDate } from "@pythnetwork/staking-sdk";
import clsx from "clsx";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useState, useMemo } from "react";
import {
  DialogTrigger,
  Button as ReactAriaButton,
} from "react-aria-components";

import background from "./background.png";
import type { States } from "../../hooks/use-api";
import { StateType as ApiStateType } from "../../hooks/use-api";
import { StateType, useAsync } from "../../hooks/use-async";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../Button";
import { Date } from "../Date";
import { ErrorMessage } from "../ErrorMessage";
import { ModalDialog } from "../ModalDialog";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  total: bigint;
  locked: bigint;
  unlockSchedule: {
    amount: bigint;
    date: Date;
  }[];
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  walletAmount: bigint;
  availableRewards: bigint;
  expiringRewards: Date | undefined;
  availableToWithdraw: bigint;
  enableGovernance: boolean;
  enableOis: boolean;
  integrityStakingWarmup: bigint;
  integrityStakingStaked: bigint;
  integrityStakingCooldown: bigint;
  integrityStakingCooldown2: bigint;
  currentEpoch: bigint;
};

export const AccountSummary = ({
  api,
  locked,
  unlockSchedule,
  lastSlash,
  walletAmount,
  total,
  availableToWithdraw,
  availableRewards,
  expiringRewards,
  enableGovernance,
  enableOis,
  integrityStakingWarmup,
  integrityStakingStaked,
  integrityStakingCooldown,
  integrityStakingCooldown2,
  currentEpoch,
}: Props) => (
  <section className="relative w-full overflow-hidden sm:border sm:border-neutral-600/50 sm:bg-pythpurple-800">
    <Image
      src={background}
      alt=""
      className="absolute -right-40 hidden h-full object-cover object-right [mask-image:linear-gradient(to_right,_transparent,_black_50%)] sm:block"
    />
    <div className="relative flex flex-col items-start justify-between gap-8 sm:p-4 md:flex-row md:items-center md:gap-16 xl:px-8 xl:py-2">
      <div>
        <div className="mb-2 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400 sm:mb-4">
          Total Balance
        </div>
        <div className="flex flex-row items-center gap-8">
          <span>
            <Tokens className="text-4xl font-light">{total}</Tokens>
          </span>
          {lastSlash && (
            <p className="max-w-48 text-sm text-red-600">
              <Tokens>{lastSlash.amount}</Tokens> were slashed on{" "}
              <Date options="time">{lastSlash.date}</Date>
            </p>
          )}
        </div>
        {locked > 0n && (
          <>
            <div className="mt-3 flex flex-row items-center gap-1 text-pythpurple-100/50 sm:mt-6 sm:text-xl">
              <Tokens>{locked}</Tokens>
              <div>locked included</div>
            </div>
            <DialogTrigger>
              <ReactAriaButton className="mt-1 text-sm text-pythpurple-400 hover:underline focus:outline-none focus-visible:underline focus-visible:outline-none">
                Show Unlock Schedule
              </ReactAriaButton>
              <ModalDialog
                title="Unlock Schedule"
                description="Your tokens will become available for withdrawal and for participation in Integrity Staking according to this schedule"
              >
                <div className="border border-neutral-600/50 bg-pythpurple-100/10 p-4 sm:px-8 sm:py-6">
                  <table>
                    <thead className="font-medium">
                      <tr>
                        <td className="pr-12 text-sm text-neutral-400">Date</td>
                        <td className="text-sm text-neutral-400">Amount</td>
                      </tr>
                    </thead>
                    <tbody>
                      {unlockSchedule.map((unlock, i) => (
                        <tr key={i}>
                          <td className="pr-12 text-xs opacity-80 sm:text-sm">
                            <Date options="time">{unlock.date}</Date>
                          </td>
                          <td>
                            <Tokens>{unlock.amount}</Tokens>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ModalDialog>
            </DialogTrigger>
          </>
        )}
        <div className="mt-3 flex flex-row items-center gap-4 sm:mt-8">
          {(enableGovernance || enableOis) && (
            <TransferButton
              actionName="Add tokens"
              actionDescription="Add funds to your balance"
              max={walletAmount}
              transfer={api.deposit}
              submitButtonText="Add tokens"
              successMessage="Your tokens have been added to your stake account"
            />
          )}
          {availableToWithdraw === 0n ? (
            <DialogTrigger>
              <Button variant="secondary" className="xl:hidden">
                Withdraw
              </Button>
              <ModalDialog title="No Withdrawable Tokens" closeButtonText="Ok">
                <p className="mb-8 font-semibold">
                  You have no tokens available for withdrawal
                </p>

                <div className="-mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
                  <InformationCircleIcon className="size-8 flex-none" />
                  <div className="text-sm">
                    You can only withdraw tokens that are unlocked and not
                    staked in either OIS or Pyth Governance
                  </div>
                </div>
              </ModalDialog>
            </DialogTrigger>
          ) : (
            <WithdrawButton
              api={api}
              max={availableToWithdraw}
              className="xl:hidden"
            />
          )}
          {enableOis && (
            <DialogTrigger>
              <Button variant="secondary" className="xl:hidden">
                Claim
              </Button>
              {availableRewards === 0n ||
              api.type === ApiStateType.LoadedNoStakeAccount ? (
                <ModalDialog title="No Rewards" closeButtonText="Ok">
                  <p>You have no rewards available to be claimed</p>
                </ModalDialog>
              ) : (
                <ClaimDialog
                  expiringRewards={expiringRewards}
                  availableRewards={availableRewards}
                  api={api}
                />
              )}
            </DialogTrigger>
          )}
        </div>
      </div>
      {!enableOis && api.type === ApiStateType.Loaded && (
        <OisUnstake
          api={api}
          className="max-w-sm xl:hidden"
          warmup={integrityStakingWarmup}
          staked={integrityStakingStaked}
          cooldown={integrityStakingCooldown}
          cooldown2={integrityStakingCooldown2}
          currentEpoch={currentEpoch}
        />
      )}
      <div className="hidden w-auto items-stretch gap-4 xl:flex">
        <BalanceCategory
          name="Unlocked & Unstaked"
          amount={availableToWithdraw}
          description="The amount of unlocked tokens that are not staked in either program"
          action={
            <WithdrawButton api={api} max={availableToWithdraw} size="small" />
          }
        />
        {!enableOis && api.type === ApiStateType.Loaded && (
          <OisUnstake
            api={api}
            warmup={integrityStakingWarmup}
            staked={integrityStakingStaked}
            cooldown={integrityStakingCooldown}
            cooldown2={integrityStakingCooldown2}
            currentEpoch={currentEpoch}
          />
        )}
        {enableOis && (
          <BalanceCategory
            name="Available Rewards"
            amount={availableRewards}
            description="Rewards you have earned from OIS"
            action={
              api.type === ApiStateType.Loaded ? (
                <ClaimButton
                  size="small"
                  variant="secondary"
                  isDisabled={availableRewards === 0n}
                  api={api}
                />
              ) : (
                <Button size="small" variant="secondary" isDisabled={true}>
                  Claim
                </Button>
              )
            }
            {...(expiringRewards !== undefined &&
              availableRewards > 0n && {
                warning: (
                  <>
                    Rewards expire one year from the epoch in which they were
                    earned. You have rewards expiring on{" "}
                    <Date>{expiringRewards}</Date>.
                  </>
                ),
              })}
          />
        )}
      </div>
    </div>
  </section>
);

type OisUnstakeProps = {
  api: States[ApiStateType.Loaded];
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  currentEpoch: bigint;
  className?: string | undefined;
};

const OisUnstake = ({
  api,
  warmup,
  staked,
  cooldown,
  cooldown2,
  currentEpoch,
  className,
}: OisUnstakeProps) => {
  const stakedPlusWarmup = useMemo(() => staked + warmup, [staked, warmup]);
  const totalCooldown = useMemo(
    () => cooldown + cooldown2,
    [cooldown, cooldown2],
  );
  const total = useMemo(
    () => staked + warmup + cooldown + cooldown2,
    [staked, warmup, cooldown, cooldown2],
  );
  const toast = useToast();
  const { state, execute } = useAsync(api.unstakeAllIntegrityStaking);

  const doUnstakeAll = useCallback(() => {
    execute()
      .then(() => {
        toast.success(
          "Your tokens are now cooling down and will be available to withdraw at the end of the next epoch",
        );
      })
      .catch((error: unknown) => {
        toast.error(error);
      });
  }, [execute, toast]);

  // eslint-disable-next-line unicorn/no-null
  return total === 0n ? null : (
    <BalanceCategory
      className={className}
      name={stakedPlusWarmup === 0n ? "OIS Cooldown" : "OIS Unstake"}
      amount={stakedPlusWarmup === 0n ? totalCooldown : stakedPlusWarmup}
      description={
        <>
          <p>
            {stakedPlusWarmup > 0n ? (
              <>
                You have tokens that are staked or in warmup to OIS. You are not
                eligible to participate in OIS because you are in a restricted
                region. Please unstake your tokens here and wait for the
                cooldown.
              </>
            ) : (
              <>You have OIS tokens in cooldown.</>
            )}
          </p>
          {stakedPlusWarmup > 0n && totalCooldown > 0n && (
            <p className="mt-4 font-semibold">Cooldown Summary</p>
          )}
          {cooldown > 0n && (
            <div className="mt-2 text-xs text-neutral-500">
              <Tokens>{cooldown}</Tokens> end{" "}
              <Date options="time">{epochToDate(currentEpoch + 2n)}</Date>
            </div>
          )}
          {cooldown2 > 0n && (
            <div className="mt-2 text-xs text-neutral-500">
              <Tokens>{cooldown2}</Tokens> end{" "}
              <Date options="time">{epochToDate(currentEpoch + 1n)}</Date>
            </div>
          )}
        </>
      }
      action={
        <>
          {stakedPlusWarmup > 0n && (
            <Button
              size="small"
              variant="secondary"
              onPress={doUnstakeAll}
              isDisabled={state.type === StateType.Complete}
              isLoading={state.type === StateType.Running}
            >
              Unstake All
            </Button>
          )}
        </>
      }
    />
  );
};

type WithdrawButtonProps = Omit<
  ComponentProps<typeof TransferButton>,
  "variant" | "actionDescription" | "actionName" | "transfer" | "successMessage"
> & {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
};

const WithdrawButton = ({ api, ...props }: WithdrawButtonProps) => (
  <TransferButton
    variant="secondary"
    actionDescription="Move funds from your account back to your wallet"
    actionName="Withdraw"
    successMessage="You have withdrawn tokens from your stake account to your wallet"
    {...(api.type === ApiStateType.Loaded && {
      transfer: api.withdraw,
    })}
    {...props}
  >
    <div className="mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
      <InformationCircleIcon className="size-8 flex-none" />
      <div className="text-sm">
        You can only withdraw tokens that are unlocked and not staked in either
        OIS or Pyth Governance
      </div>
    </div>
  </TransferButton>
);

type BalanceCategoryProps = {
  name: string;
  amount: bigint;
  description: ReactNode;
  action: ReactNode;
  warning?: ReactNode | undefined;
  className?: string | undefined;
};

const BalanceCategory = ({
  className,
  name,
  amount,
  description,
  action,
  warning,
}: BalanceCategoryProps) => (
  <div
    className={clsx(
      "flex w-full flex-col justify-between border border-neutral-600/50 bg-pythpurple-800/60 p-4 backdrop-blur sm:px-6 xl:w-80 2xl:w-96",
      className,
    )}
  >
    <div>
      <div className="mb-2 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400">
        {name}
      </div>
      <div>
        <Tokens className="text-xl font-light">{amount}</Tokens>
      </div>
      <div className="mt-2 text-sm text-neutral-500">{description}</div>
    </div>
    <div className="mt-2 flex flex-row items-center gap-4">
      {action}
      {warning && <div className="text-xs text-red-600">{warning}</div>}
    </div>
  </div>
);

type ClaimDialogProps = {
  availableRewards: bigint;
  expiringRewards: Date | undefined;
  api: States[ApiStateType.Loaded];
};

const ClaimDialog = ({
  api,
  expiringRewards,
  availableRewards,
}: ClaimDialogProps) => {
  const [closeDisabled, setCloseDisabled] = useState(false);

  return (
    <ModalDialog title="Claim" closeDisabled={closeDisabled}>
      {({ close }) => (
        <ClaimDialogContents
          expiringRewards={expiringRewards}
          availableRewards={availableRewards}
          api={api}
          close={close}
          setCloseDisabled={setCloseDisabled}
        />
      )}
    </ModalDialog>
  );
};

type ClaimDialogContentsProps = {
  availableRewards: bigint;
  expiringRewards: Date | undefined;
  api: States[ApiStateType.Loaded];
  close: () => void;
  setCloseDisabled: (value: boolean) => void;
};

const ClaimDialogContents = ({
  api,
  expiringRewards,
  availableRewards,
  close,
  setCloseDisabled,
}: ClaimDialogContentsProps) => {
  const { state, execute } = useAsync(api.claim);

  const toast = useToast();

  const doClaim = useCallback(() => {
    setCloseDisabled(true);
    execute()
      .then(() => {
        close();
        toast.success("You have claimed your rewards");
      })
      .catch(() => {
        /* no-op since this is already handled in the UI using `state` and is logged in useAsync */
      })
      .finally(() => {
        setCloseDisabled(false);
      });
  }, [execute, toast, close, setCloseDisabled]);

  return (
    <>
      <p className="mb-4">
        Claim your <Tokens>{availableRewards}</Tokens> rewards
      </p>
      {expiringRewards && (
        <div className="mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
          <InformationCircleIcon className="size-8 flex-none" />
          <div className="text-sm">
            Rewards expire one year from the epoch in which they were earned.
            You have rewards expiring on <Date>{expiringRewards}</Date>.
          </div>
        </div>
      )}
      {state.type === StateType.Error && (
        <div className="mt-4 max-w-sm">
          <ErrorMessage error={state.error} />
        </div>
      )}
      <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          size="noshrink"
          onPress={close}
        >
          Cancel
        </Button>
        <Button
          className="w-full sm:w-auto"
          size="noshrink"
          isDisabled={state.type === StateType.Complete}
          isLoading={state.type === StateType.Running}
          onPress={doClaim}
        >
          Claim
        </Button>
      </div>
    </>
  );
};

type ClaimButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "disabled" | "loading"
> & {
  api: States[ApiStateType.Loaded];
};

const ClaimButton = ({ api, ...props }: ClaimButtonProps) => {
  const { state, execute } = useAsync(api.claim);

  const toast = useToast();

  const doClaim = useCallback(() => {
    execute()
      .then(() => {
        toast.success("You have claimed your rewards");
      })
      .catch((error: unknown) => {
        toast.error(error);
      });
  }, [execute, toast]);

  return (
    <Button
      onPress={doClaim}
      isDisabled={state.type === StateType.Complete}
      isLoading={state.type === StateType.Running}
      {...props}
    >
      Claim
    </Button>
  );
};

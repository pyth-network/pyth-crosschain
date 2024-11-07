import { ArrowLongDownIcon } from "@heroicons/react/24/outline";
import { epochToDate } from "@pythnetwork/staking-sdk";
import clsx from "clsx";
import type { HTMLAttributes, ReactNode, ComponentProps } from "react";
import { DialogTrigger } from "react-aria-components";

import { Button } from "../Button";
import { Date } from "../Date";
import { ModalDialog } from "../ModalDialog";
import { StakingTimeline } from "../StakingTimeline";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = HTMLAttributes<HTMLDivElement> & {
  name: string;
  helpDialog: ReactNode;
  description: ReactNode;
  tagline: ReactNode;
  collapseTokenOverview?: boolean | undefined;
  tokenOverview: TokenOverviewProps;
};

export const ProgramSection = ({
  name,
  className,
  helpDialog,
  description,
  tagline,
  children,
  tokenOverview,
  collapseTokenOverview,
  ...props
}: Props) => (
  <section
    className={clsx(
      "border-x border-b border-neutral-600/50 bg-pythpurple-800 px-4 py-6 sm:px-8",
      className,
    )}
    {...props}
  >
    <div className="mx-auto flex max-w-4xl flex-col gap-2 px-2 pb-6 sm:px-6 sm:py-10">
      <div className="flex flex-row items-start gap-8">
        <div className="grow">
          <h1 className="text-lg font-light xs:text-xl sm:mb-2 sm:text-2xl md:text-3xl">
            {name}
          </h1>
          <div className="text-sm opacity-60 sm:text-lg md:font-semibold md:opacity-100">
            {tagline}
          </div>
        </div>
        <div className="my-2 flex-none">
          <DialogTrigger>
            <Button variant="secondary">Help</Button>
            {helpDialog}
          </DialogTrigger>
        </div>
      </div>
      <div className="hidden max-w-prose text-sm opacity-60 md:block">
        {description}
      </div>
    </div>
    {collapseTokenOverview && (
      <DialogTrigger>
        <Button className="mx-auto block w-full max-w-96 lg:hidden">
          Token Overview
        </Button>
        <ModalDialog title="Token Overview" description={name}>
          <TokenOverview className={className} {...tokenOverview} />
        </ModalDialog>
      </DialogTrigger>
    )}
    <TokenOverview
      className={clsx({ "hidden lg:flex": collapseTokenOverview })}
      {...tokenOverview}
    />
    {children}
  </section>
);

type TokenOverviewProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  currentEpoch: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  available: bigint;
  availableToStakeDetails?: ReactNode | ReactNode[] | undefined;
} & (
    | { stake?: never; stakeDescription?: never }
    | {
        stake: ComponentProps<typeof TransferButton>["transfer"] | undefined;
        stakeDescription: string;
      }
  ) &
  (
    | { cancelWarmup?: never; cancelWarmupDescription?: never }
    | {
        cancelWarmup:
          | ComponentProps<typeof TransferButton>["transfer"]
          | undefined;
        cancelWarmupDescription: string;
      }
  ) &
  (
    | { unstake?: never; unstakeDescription?: never }
    | {
        unstake: ComponentProps<typeof TransferButton>["transfer"] | undefined;
        unstakeDescription: string;
      }
  );

const TokenOverview = ({
  className,
  currentEpoch,
  warmup,
  staked,
  cooldown,
  cooldown2,
  availableToStakeDetails,
  stake,
  stakeDescription,
  available,
  cancelWarmup,
  cancelWarmupDescription,
  unstake,
  unstakeDescription,
  ...props
}: TokenOverviewProps) => (
  <div
    className={clsx(
      "flex flex-col items-stretch justify-center border-neutral-600/50 md:flex-row lg:mx-auto lg:border lg:bg-white/5 lg:p-6",
      className,
    )}
    {...props}
  >
    <Position
      name="Available to Stake"
      nameClassName="bg-[rgba(43,_129,_167,_0.25)]"
      details={availableToStakeDetails}
      {...(stakeDescription !== undefined && {
        actions: (
          <TransferButton
            size="small"
            actionDescription={stakeDescription}
            actionName="Stake"
            max={available}
            transfer={stake}
            successMessage="Your tokens are now in warm up and will be staked at the start of the next epoch"
          >
            <StakingTimeline currentEpoch={currentEpoch} />
          </TransferButton>
        ),
      })}
    >
      {available}
    </Position>
    <Arrow />
    <Position
      name="Warmup"
      nameClassName="bg-[rgba(206,_153,_247,_0.25)]"
      {...(warmup > 0n && {
        details: (
          <div className="mt-2 text-xs text-neutral-500">
            Staking <Date options="time">{epochToDate(currentEpoch + 1n)}</Date>
          </div>
        ),
      })}
      {...(cancelWarmupDescription !== undefined && {
        actions: (
          <TransferButton
            size="small"
            variant="secondary"
            actionDescription={cancelWarmupDescription}
            actionName="Cancel"
            submitButtonText="Cancel Warmup"
            title="Cancel Warmup"
            max={warmup}
            transfer={cancelWarmup}
            successMessage="Your tokens are no longer in warmup for staking"
          />
        ),
      })}
    >
      {warmup}
    </Position>
    <Arrow />
    <Position
      name="Staked"
      nameClassName="bg-[rgba(105,_24,_238,_0.25)]"
      {...(unstakeDescription !== undefined && {
        actions: (
          <TransferButton
            size="small"
            variant="secondary"
            actionDescription={unstakeDescription}
            actionName="Unstake"
            max={staked}
            transfer={unstake}
            successMessage="Your tokens are now cooling down and will be available to withdraw at the end of the next epoch"
          >
            <StakingTimeline cooldownOnly currentEpoch={currentEpoch} />
          </TransferButton>
        ),
      })}
    >
      {staked}
    </Position>
    <Arrow />
    <Position
      name="Cooldown"
      nameClassName="bg-[rgba(179,_157,_222,_0.25)]"
      details={
        <>
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
    >
      {cooldown + cooldown2}
    </Position>
  </div>
);

type PositionProps = {
  name: string;
  nameClassName?: string | undefined;
  className?: string | undefined;
  children: bigint;
  actions?: ReactNode | ReactNode[];
  details?: ReactNode;
};

const Position = ({
  name,
  nameClassName,
  details,
  className,
  children,
  actions,
}: PositionProps) => (
  <div
    className={clsx(
      "mx-auto flex w-full max-w-64 flex-col overflow-hidden border border-neutral-600/50 bg-white/5 p-4 md:mx-0 lg:bg-pythpurple-800 lg:p-6",
      className,
    )}
  >
    <div
      className={clsx(
        "mb-2 inline-block flex-none border border-neutral-600/50 px-1 py-0.5 text-xs text-neutral-400 sm:px-3 sm:py-1",
        nameClassName,
      )}
    >
      {name}
    </div>
    <div className="flex grow flex-row items-end justify-between gap-6 sm:flex-col sm:items-start">
      <div>
        <div>
          <Tokens className="text-lg font-light sm:text-xl lg:text-3xl">
            {children}
          </Tokens>
        </div>
        {details}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  </div>
);

const Arrow = () => (
  <div className="grid place-content-center">
    <ArrowLongDownIcon className="m-2 size-4 flex-none [mask-image:linear-gradient(to_bottom,_transparent,_black_125%)] md:-rotate-90 lg:m-4 lg:scale-y-[200%]" />
  </div>
);

import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { HTMLAttributes, ReactNode, ComponentProps } from "react";

import { getUpcomingEpoch, getNextFullEpoch } from "../../api";
import { StakingTimeline } from "../StakingTimeline";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = HTMLAttributes<HTMLDivElement> & {
  locked?: bigint | undefined;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  small?: boolean | undefined;
} & (
    | {
        stake?: never;
        stakeDescription?: never;
        available?: bigint | undefined;
      }
    | {
        available: bigint;
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

export const PositionFlowchart = ({
  className,
  small,
  locked,
  available,
  warmup,
  staked,
  cooldown,
  cooldown2,
  stake,
  stakeDescription,
  cancelWarmup,
  cancelWarmupDescription,
  unstake,
  unstakeDescription,
  ...props
}: Props) => (
  <div
    className={clsx("flex flex-row items-stretch justify-center", className)}
    {...props}
  >
    {locked !== undefined && (
      <Position
        name="Locked"
        className="mr-12"
        small={small}
        nameClassName="bg-red-950"
      >
        {locked}
      </Position>
    )}
    {available !== undefined && (
      <>
        <Position
          name="Available to Stake"
          small={small}
          nameClassName="bg-[rgba(43,_129,_167,_0.25)]"
          {...(stake !== undefined &&
            available > 0n && {
              actions: (
                <TransferButton
                  small
                  actionDescription={stakeDescription}
                  actionName="Stake"
                  max={available}
                  transfer={stake}
                >
                  <StakingTimeline />
                </TransferButton>
              ),
            })}
        >
          {available}
        </Position>
        <Arrow />
      </>
    )}
    <Position
      name="Warmup"
      small={small}
      nameClassName="bg-[rgba(206,_153,_247,_0.25)]"
      {...(warmup > 0n && {
        details: (
          <div className="mt-2 text-xs text-neutral-500">
            Staking {getUpcomingEpoch().toLocaleString()}
          </div>
        ),
        ...(cancelWarmup !== undefined && {
          actions: (
            <TransferButton
              small
              secondary
              actionDescription={cancelWarmupDescription}
              actionName="Cancel"
              submitButtonText="Cancel Warmup"
              title="Cancel Warmup"
              max={warmup}
              transfer={cancelWarmup}
            />
          ),
        }),
      })}
    >
      {warmup}
    </Position>
    <Arrow />
    <Position
      name="Staked"
      small={small}
      nameClassName="bg-[rgba(105,_24,_238,_0.25)]"
      {...(unstake !== undefined &&
        staked > 0n && {
          actions: (
            <TransferButton
              small
              secondary
              actionDescription={unstakeDescription}
              actionName="Unstake"
              max={staked}
              transfer={unstake}
            >
              <StakingTimeline cooldownOnly />
            </TransferButton>
          ),
        })}
    >
      {staked}
    </Position>
    <Arrow />
    <Position
      name="Cooldown"
      small={small}
      nameClassName="bg-[rgba(179,_157,_222,_0.25)]"
      details={
        <>
          {cooldown > 0n && (
            <div className="mt-2 text-xs text-neutral-500">
              <Tokens>{cooldown}</Tokens> end{" "}
              {getUpcomingEpoch().toLocaleString()}
            </div>
          )}
          {cooldown2 > 0n && (
            <div className="mt-2 text-xs text-neutral-500">
              <Tokens>{cooldown2}</Tokens> end{" "}
              {getNextFullEpoch().toLocaleString()}
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
  small: boolean | undefined;
  nameClassName?: string | undefined;
  className?: string | undefined;
  children: bigint;
  actions?: ReactNode | ReactNode[];
  details?: ReactNode;
};

const Position = ({
  name,
  small,
  nameClassName,
  details,
  className,
  children,
  actions,
}: PositionProps) => (
  <div
    className={clsx(
      "flex w-full flex-col justify-between gap-6 overflow-hidden border border-neutral-600/50 bg-pythpurple-800",
      small ? "p-4" : "p-6",
      className,
    )}
  >
    <div>
      <div
        className={clsx(
          "mb-2 inline-block border border-neutral-600/50 text-xs text-neutral-400",
          small ? "px-1 py-0.5" : "px-3 py-1",
          nameClassName,
        )}
      >
        {name}
      </div>
      <div>
        <Tokens className={clsx("font-light", small ? "text-lg" : "text-3xl")}>
          {children}
        </Tokens>
      </div>
      {details}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);

const Arrow = () => (
  <div className="grid place-content-center">
    <ArrowLongRightIcon className="mx-4 size-4 flex-none scale-x-[200%] [mask-image:linear-gradient(to_right,_transparent,_black_125%)]" />
  </div>
);

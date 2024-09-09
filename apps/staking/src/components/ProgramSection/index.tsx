import { ArrowLongDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { HTMLAttributes, ReactNode, ComponentProps } from "react";

import { getUpcomingEpoch, getNextFullEpoch } from "../../api";
import { StakingTimeline } from "../StakingTimeline";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = HTMLAttributes<HTMLDivElement> & {
  name: string;
  description: string;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  availableToStakeDetails?: ReactNode | ReactNode[] | undefined;
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

export const ProgramSection = ({
  className,
  name,
  description,
  children,
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
}: Props) => (
  <section
    className={clsx(
      "border border-neutral-600/50 bg-pythpurple-800 px-4 py-6 sm:p-10",
      className,
    )}
    {...props}
  >
    <h2 className="text-xl font-light sm:text-3xl">{name}</h2>
    <p className="text-sm sm:text-base">{description}</p>
    <div className="mt-8 flex flex-col items-stretch justify-center border border-neutral-600/50 bg-white/5 px-2 py-6 sm:p-10 xl:flex-row">
      {available !== undefined && (
        <>
          <Position
            name="Available to Stake"
            nameClassName="bg-[rgba(43,_129,_167,_0.25)]"
            details={availableToStakeDetails}
            {...(stake !== undefined &&
              available > 0n && {
                actions: (
                  <TransferButton
                    size="small"
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
                size="small"
                variant="secondary"
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
        nameClassName="bg-[rgba(105,_24,_238,_0.25)]"
        {...(unstake !== undefined &&
          staked > 0n && {
            actions: (
              <TransferButton
                size="small"
                variant="secondary"
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
    {children}
  </section>
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
      "flex w-full flex-col overflow-hidden border border-neutral-600/50 bg-pythpurple-800 p-4 sm:p-6",
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
    <div className="flex grow flex-row items-end justify-between gap-6 xl:flex-col xl:items-start">
      <div>
        <div>
          <Tokens className="text-xl font-light sm:text-3xl">{children}</Tokens>
        </div>
        {details}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  </div>
);

const Arrow = () => (
  <div className="grid place-content-center">
    <ArrowLongDownIcon className="m-4 size-4 flex-none scale-y-[200%] [mask-image:linear-gradient(to_bottom,_transparent,_black_125%)] xl:-rotate-90" />
  </div>
);

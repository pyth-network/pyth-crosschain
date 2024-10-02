import { ArrowLongDownIcon } from "@heroicons/react/24/outline";
import { epochToDate } from "@pythnetwork/staking-sdk";

import { Date } from "../Date";

type Props = {
  cooldownOnly?: boolean | undefined;
  currentEpoch: bigint;
};

export const StakingTimeline = ({ cooldownOnly, currentEpoch }: Props) => (
  <div className="mb-2 flex flex-col gap-1">
    <div className="text-sm">Timeline</div>
    <div className="grid grid-cols-[max-content_1fr_max-content] items-center gap-x-4 gap-y-3 border border-neutral-600/50 bg-pythpurple-100/10 px-4 py-2 text-xs font-light sm:px-8 sm:py-6 sm:text-sm">
      {!cooldownOnly && (
        <>
          <div className="size-4 rounded-full border border-dashed border-pythpurple-100" />
          <div>Warmup</div>
          <Date options="time" className="text-right">
            {epochToDate(currentEpoch + 1n)}
          </Date>
          <ArrowLongDownIcon className="size-4 scale-y-[200%] [mask-image:linear-gradient(to_bottom,_transparent,_black_125%)]" />
          <div>Staking</div>
          <div className="text-right">Unlimited</div>
        </>
      )}
      <div className="size-4 rounded-full border border-pythpurple-100 bg-pythpurple-600" />
      <div>Cooldown</div>
      {cooldownOnly ? (
        <Date options="time" className="text-right">
          {epochToDate(currentEpoch + 2n)}
        </Date>
      ) : (
        <div className="text-right">One full epoch</div>
      )}
    </div>
  </div>
);

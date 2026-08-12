"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import {
  GEO_BLOCKED_SEGMENT,
  GOVERNANCE_ONLY_SEGMENT,
} from "../../config/isomorphic";
import { Link } from "../Link";

export const OIS_GOVERNANCE_UPDATE_URL =
  "https://forum.pyth.network/t/ois-rewards-update-april-2026/2479";

type Props = {
  isEnabled: boolean;
};

export const OisPausedBanner = ({ isEnabled }: Props) => {
  const segment = useSelectedLayoutSegment();
  const isRestrictedMode =
    segment === GEO_BLOCKED_SEGMENT || segment === GOVERNANCE_ONLY_SEGMENT;

  // Restricted regions already get the legal notice banner and can't use OIS
  // anyway, so showing this too would just stack two banners on those pages.
  // Render an empty node when hidden to keep the `<body>` grid row count
  // stable.
  return isEnabled && !isRestrictedMode ? (
    <section
      aria-labelledby="ois-paused-banner-heading"
      className="mx-auto mt-8 flex max-w-3xl flex-col gap-2 border-l-4 border-amber-400 bg-amber-950/80 px-8 py-6"
    >
      <h2
        className="text-xl font-medium text-amber-200"
        id="ois-paused-banner-heading"
      >
        Oracle Integrity Staking rewards are paused
      </h2>
      <p className="text-sm font-light">
        Following OP-PIP-103, the OIS reward rate was set to 0 on 22 April 2026.
        Staking and slashing remain active — stake assigned to a publisher is
        still subject to slashing. You can unstake and withdraw at any time.
        Governance staking is unaffected.{" "}
        <Link
          className="underline hover:no-underline focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200"
          href={OIS_GOVERNANCE_UPDATE_URL}
          rel="noreferrer"
          target="_blank"
        >
          Read the governance update
        </Link>
        .
      </p>
    </section>
  ) : (
    <div />
  );
};

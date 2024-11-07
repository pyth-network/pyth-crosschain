"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import {
  GEO_BLOCKED_SEGMENT,
  GOVERNANCE_ONLY_SEGMENT,
} from "../../config/isomorphic";
import { Link } from "../Link";

export const RestrictedRegionBanner = () => {
  const segment = useSelectedLayoutSegment();
  const isRestrictedMode =
    segment === GEO_BLOCKED_SEGMENT || segment === GOVERNANCE_ONLY_SEGMENT;

  return isRestrictedMode ? (
    <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-2 bg-red-900 px-8 py-6">
      <h2 className="mb-2 text-2xl font-light">LEGAL NOTICE</h2>
      <p className="font-medium">
        Your access to this Website and its Services is restricted.
      </p>
      <p className="text-sm font-light">
        It appears that you are located in a jurisdiction subject to
        restrictions under our{" "}
        <Link className="underline" href="/terms-of-service">
          Terms of Service
        </Link>
        . As a result, you are not permitted to use or access certain Services
        on this Website. However, you are still allowed to use the Unstake and
        Withdraw functions.
      </p>
      <p className="text-sm font-light">
        Any attempt to bypass these restrictions, including the use of VPNs or
        similar technologies, is strictly prohibited.
      </p>
    </div>
  ) : (
    <div />
  );
};

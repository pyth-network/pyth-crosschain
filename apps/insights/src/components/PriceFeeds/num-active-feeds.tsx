"use client";

import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { Suspense, use } from "react";

type Props = {
  numFeedsPromise: Promise<number>;
};

export const NumActiveFeeds = ({ numFeedsPromise }: Props) => (
  <Suspense fallback={<Skeleton width={10} />}>
    <ResolvedNumActiveFeeds numFeedsPromise={numFeedsPromise} />
  </Suspense>
);

const ResolvedNumActiveFeeds = ({ numFeedsPromise }: Props) =>
  use(numFeedsPromise);

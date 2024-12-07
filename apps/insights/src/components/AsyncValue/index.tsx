"use client";

import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { Suspense, use } from "react";

type Props<T> = {
  placeholderWidth: number;
  valuePromise: Promise<T>;
};

export const AsyncValue = <T,>({
  placeholderWidth,
  valuePromise,
}: Props<T>) => (
  <Suspense fallback={<Skeleton width={placeholderWidth} />}>
    <ResolvedValue valuePromise={valuePromise} />
  </Suspense>
);

const ResolvedValue = <T,>({ valuePromise }: Pick<Props<T>, "valuePromise">) =>
  use(valuePromise);

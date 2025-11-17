import type { PriceComponent, PriceData } from "@pythnetwork/client";
import type { ReactNode } from "react";

import type { Cluster } from "../../services/pyth";

export type LiveAggregatedPriceOrConfidenceProps = Pick<
  PriceProps,
  "updatePageTitle"
> & {
  cluster: Cluster;
  feedKey: string;
};

export type LivePriceOrConfidenceProps =
  LiveAggregatedPriceOrConfidenceProps & {
    publisherKey?: string | undefined;
  };

export type LiveComponentConfidenceProps = {
  [key in keyof Omit<
    Required<LivePriceOrConfidenceProps>,
    "updatePageTitle"
  >]: NonNullable<LivePriceOrConfidenceProps[key]>;
};

export type LiveValueProps<T extends keyof PriceData> = {
  field: T;
  feedKey: string;
  defaultValue?: ReactNode | undefined;
  cluster: Cluster;
};

export type LiveComponentValueProps<T extends keyof PriceComponent["latest"]> =
  {
    field: T;
    feedKey: string;
    publisherKey: string;
    defaultValue?: ReactNode | undefined;
    cluster: Cluster;
  };

export type PriceProps = {
  current?: number | undefined;
  exponent?: number | undefined;
  prev?: number | undefined;
  /**
   * if true, will automatically update the document.title
   * to be prefixed with the price when it changes.
   * Defaults to false
   */
  updatePageTitle?: boolean | undefined;
};

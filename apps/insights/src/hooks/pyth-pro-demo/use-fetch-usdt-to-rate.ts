"use client";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import { useEffect, useMemo, useRef, useState } from "react";

type UseFetchUsdtToUsdRateOpts = {
  enabled?: boolean;
  refetchInterval?: number;
  url?: string;
};

export function useFetchUsdtToUsdRate(opts?: UseFetchUsdtToUsdRateOpts) {
  /** props */
  const {
    enabled = true,
    refetchInterval,
    url = "https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
  } = opts ?? {};

  /** refs */
  const abortSignalRef = useRef<AbortController | undefined>(undefined);

  /** state */
  const [usdtToUsdRate, setUsdtToUsdRate] =
    useState<Nullish<number>>(undefined);
  const [fetchTime, setFetchTime] = useState(0);
  const [error, setError] = useState<Error | undefined>(undefined);

  /** effects */
  useEffect(() => {
    if (abortSignalRef.current) {
      abortSignalRef.current.abort();
    }

    if (!enabled) return;

    const a = new AbortController();
    abortSignalRef.current = a;

    fetch(url, { signal: a.signal })
      .then((r) => r.json())
      .then((data: HermesPriceResponse) => {
        const price = Number(data.parsed[0]?.price.price) / Math.pow(10, 8);
        if (isNumber(price)) {
          setUsdtToUsdRate(price);
        } else {
          setError(
            new Error(
              `usdt rate returned from API call was not a number (API returned ${String(price)})`,
            ),
          );
        }
      })
      .catch(setError);

    return () => {
      abortSignalRef.current?.abort();
    };
  }, [enabled, fetchTime, url]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const t = setTimeout(() => {
      setFetchTime(Date.now());
    }, refetchInterval);
    return () => {
      clearTimeout(t);
    };
  }, [enabled, refetchInterval]);

  return useMemo(() => ({ error, usdtToUsdRate }), [error, usdtToUsdRate]);
}

export type HermesPriceResponse = {
  binary: Binary;
  parsed: Parsed[];
};

export type Binary = {
  encoding: string;
  data: string[];
};

export type Parsed = {
  id: string;
  price: Price;
  ema_price: Price;
  metadata: Metadata;
};

export type Price = {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
};

export type Metadata = {
  slot: number;
  proof_available_time: number;
  prev_publish_time: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * fetches the latest USDT (token) rate to the USD actual dollar rate
 * from Pyth
 */
export function useFetchUsdToUsdRate(
  url = "https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
) {
  /** state */
  const [usdtToUsdRate, setUsdtToUsdRate] = useState(1);
  const [error, setError] = useState<Error | undefined>(undefined);

  /** refs */
  const abortSignal = useRef<AbortController | undefined>(undefined);

  /** effects */
  useEffect(() => {
    if (abortSignal.current) {
      abortSignal.current.abort();
    }

    const abt = new AbortController();
    abortSignal.current = abt;

    fetch(url, { mode: "cors", signal: abt.signal })
      .then((r) => r.json())
      .then((data: any) => {
        const price = Number(data.parsed?.[0].price.price) / Math.pow(10, 8);
        setUsdtToUsdRate(price);
      })
      .catch(setError);

    return () => {
      abt.abort();
    };
  }, [url]);

  return useMemo(() => ({ error, usdtToUsdRate }), [error, usdtToUsdRate]);
}

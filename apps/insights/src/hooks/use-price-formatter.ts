import { useCallback, useMemo } from "react";
import { useNumberFormatter } from "react-aria";

export const usePriceFormatter = (exponent?: number) => {
  // Calculate the number of decimal places based on the exponent
  // The exponent represents the power of 10, so -8 means 8 decimal places
  const decimals = exponent === undefined ? undefined : Math.abs(exponent);

  const bigNumberFormatter = useNumberFormatter({ maximumFractionDigits: 2 });
  const smallNumberFormatter = useNumberFormatter({
    maximumSignificantDigits: 6,
  });
  const exponentBasedFormatter = useNumberFormatter({
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const format = useCallback(
    (n: number) => {
      // If we have an exponent, use exponent-based formatting
      if (decimals !== undefined) {
        return exponentBasedFormatter.format(n);
      }
      // Otherwise, fall back to the old behavior
      if (n >= 1000) {
        return bigNumberFormatter.format(n);
      }
      return smallNumberFormatter.format(n);
    },
    [
      bigNumberFormatter,
      smallNumberFormatter,
      exponentBasedFormatter,
      decimals,
    ],
  );
  return useMemo(() => ({ format }), [format]);
};

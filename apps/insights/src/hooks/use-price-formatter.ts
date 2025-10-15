import { useCallback, useMemo } from "react";
import { useNumberFormatter } from "react-aria";

export const usePriceFormatter = (
  exponent?: number,
  { subscriptZeros = true }: { subscriptZeros?: boolean } = {},
) => {
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
        const formatted = exponentBasedFormatter.format(n);
        return subscriptZeros ? formatToSubscriptNumber(formatted) : formatted;
      }
      // Otherwise, fall back to the old behavior
      if (n >= 1000) {
        const formatted = bigNumberFormatter.format(n);
        return subscriptZeros ? formatToSubscriptNumber(formatted) : formatted;
      }
      const formatted = smallNumberFormatter.format(n);
      return subscriptZeros ? formatToSubscriptNumber(formatted) : formatted;
    },
    [
      bigNumberFormatter,
      smallNumberFormatter,
      exponentBasedFormatter,
      decimals,
      subscriptZeros,
    ],
  );
  return useMemo(() => ({ format }), [format]);
};

const formatToSubscriptNumber = (numString: string) => {
  const parts = numString.split(".");

  const [integerPart, decimalPart] = parts;
  if (integerPart && decimalPart) {
    const zerosCount =
      decimalPart.length - decimalPart.replace(/^0+/, "").length;

    return zerosCount < 5
      ? numString
      : integerPart +
          "." +
          "0" +
          (zerosCount > 9
            ? String.fromCodePoint(0x20_80 + Math.floor(zerosCount / 10))
            : "") +
          String.fromCodePoint(0x20_80 + (zerosCount % 10)) +
          decimalPart.replace(/^0+/, "");
  } else {
    return numString;
  }
};

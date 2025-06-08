import { useCallback, useMemo } from "react";
import { useNumberFormatter } from "react-aria";

export const usePriceFormatter = () => {
  const bigNumberFormatter = useNumberFormatter({ maximumFractionDigits: 2 });
  const smallNumberFormatter = useNumberFormatter({
    maximumSignificantDigits: 5,
  });
  const format = useCallback(
    (n: number) =>
      n >= 1000
        ? bigNumberFormatter.format(n)
        : formatToSubscriptNumber(smallNumberFormatter.format(n)),
    [bigNumberFormatter, smallNumberFormatter],
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

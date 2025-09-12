"use client";

import { useMemo } from "react";
import { useNumberFormatter } from "react-aria";

type Props = Parameters<typeof useNumberFormatter>[0] & {
  value: number | bigint;
};

export const FormattedNumber = ({ value, ...args }: Props) => {
  const numberFormatter = useNumberFormatter(args);
  return useMemo(() => numberFormatter.format(value), [numberFormatter, value]);
};

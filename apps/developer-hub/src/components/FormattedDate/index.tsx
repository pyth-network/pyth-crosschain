"use client";

import { useMemo } from "react";
import { useDateFormatter } from "react-aria";

type Props = Parameters<typeof useDateFormatter>[0] & {
  value: Date;
};

export const FormattedDate = ({ value, ...args }: Props) => {
  const numberFormatter = useDateFormatter(args);
  return useMemo(() => numberFormatter.format(value), [numberFormatter, value]);
};

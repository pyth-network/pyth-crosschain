"use client";

import * as dnum from "dnum";
import { useMemo } from "react";
import { useLocale } from "react-aria";

const DECIMALS = 6;

type Props = {
  mode?: "compact" | "wholePart" | "full";
  children: bigint;
};

export const FormattedTokens = ({ children, mode = "compact" }: Props) => {
  const { locale } = useLocale();
  const value = useMemo(
    () =>
      dnum.format([children, DECIMALS], {
        compact: mode === "compact",
        locale,
      }),
    [children, locale, mode],
  );

  return mode === "wholePart" ? value.split(".")[0] : value;
};

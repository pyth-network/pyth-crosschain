"use client";

import * as dnum from "dnum";
import { useMemo } from "react";
import { useLocale } from "react-aria";

const DECIMALS = 6;

type Props = {
  mode?: "compact" | "wholePart" | "full";
  tokens: bigint;
};

export const FormattedTokens = ({ tokens, mode = "compact" }: Props) => {
  const { locale } = useLocale();
  const value = useMemo(
    () =>
      dnum.format([tokens, DECIMALS], {
        compact: mode === "compact",
        locale,
      }),
    [tokens, locale, mode],
  );

  return mode === "wholePart" ? value.split(".")[0] : value;
};

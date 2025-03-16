"use client";

import clsx from "clsx";
import * as dnum from "dnum";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Button, TooltipTrigger, useLocale } from "react-aria-components";

import Pyth from "./pyth.svg";
import { DECIMALS } from "../../tokens";
import { Tooltip } from "../Tooltip";

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
  children: bigint;
};

export const Tokens = ({ children, ...props }: Props) => {
  const { locale } = useLocale();
  const compactValue = useMemo(
    () => dnum.format([children, DECIMALS], { compact: true, locale }),
    [children, locale],
  );
  const fullValue = useMemo(
    () => dnum.format([children, DECIMALS], { locale }),
    [children, locale],
  );

  return compactValue === fullValue ? (
    <TokenButton {...props}>{compactValue}</TokenButton>
  ) : (
    <TooltipTrigger delay={0}>
      <TokenButton {...props}>{compactValue}</TokenButton>
      <Tooltip className="flex flex-row items-center gap-[0.25em]">
        <Pyth className="aspect-square size-[1em]" />
        <span>{fullValue}</span>
      </Tooltip>
    </TooltipTrigger>
  );
};

type TokenButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children: string;
};

const TokenButton = ({ children, className, ...props }: TokenButtonProps) => (
  <Button
    className={clsx(
      "inline-flex cursor-default items-center gap-[0.25em] align-top active:outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
      className,
    )}
    {...props}
  >
    <Pyth className="aspect-square size-[1em]" />
    <span>{children}</span>
  </Button>
);

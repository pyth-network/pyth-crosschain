"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useIsSSR } from "react-aria";
import { Button as BaseButton } from "react-aria-components";

import type { Props as ButtonProps } from "../Button";
import { Button } from "../Button";
import { Skeleton } from "../Skeleton";
import styles from "./index.module.scss";

type OwnProps = {
  largeScreenContent?: ReactNode;
  smallScreenContent?: ReactNode;
};

type Props = Pick<
  ButtonProps<typeof BaseButton>,
  "beforeIcon" | "size" | "onClick" | "className" | "isPending"
> &
  OwnProps;

const SearchShortcutText = () => {
  const isSSR = useIsSSR();
  return isSSR ? <Skeleton width={7} /> : <SearchTextImpl />;
};

const SearchTextImpl = () => {
  const isMac = useMemo(() => navigator.userAgent.includes("Mac"), []);
  return isMac ? "⌘ K" : "Ctrl K";
};

export const SearchButton = ({
  beforeIcon,
  largeScreenContent,
  smallScreenContent,
  ...props
}: Props) => {
  return (
    <div className={styles.searchButton}>
      <Button
        className={clsx(styles.largeScreenSearchButton, props.className)}
        variant="outline"
        beforeIcon={beforeIcon ?? <MagnifyingGlass />}
        size="sm"
        rounded
        {...props}
      >
        {largeScreenContent ?? <SearchShortcutText />}
      </Button>
      <Button
        className={clsx(styles.smallScreenSearchButton, props.className)}
        hideText
        variant="ghost"
        beforeIcon={beforeIcon ?? <MagnifyingGlass />}
        size="sm"
        rounded
        {...props}
      >
        {smallScreenContent ?? <SearchShortcutText />}
      </Button>
    </div>
  );
};

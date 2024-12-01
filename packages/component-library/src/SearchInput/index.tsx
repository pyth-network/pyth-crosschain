"use client";

import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import { type CSSProperties, type ComponentProps } from "react";
import { Input, SearchField } from "react-aria-components";

import styles from "./index.module.scss";
import { UnstyledButton } from "../UnstyledButton/index.js";

export const SIZES = ["xs", "sm", "md", "lg"] as const;

type Props = ComponentProps<typeof SearchField> & {
  label?: string | undefined;
  size?: (typeof SIZES)[number] | undefined;
  width: number;
  isPending?: boolean | undefined;
};

export const SearchInput = ({
  label,
  size = "md",
  width,
  className,
  isPending,
  ...props
}: Props) => (
  <SearchField
    aria-label={label ?? "Search"}
    className={clsx(styles.searchInput, className)}
    style={{ "--width": width } as CSSProperties}
    data-size={size}
    {...(isPending && { "data-pending": "" })}
    {...props}
  >
    <Input className={styles.input ?? ""} placeholder="Search" />
    <MagnifyingGlass className={styles.searchIcon} />
    <CircleNotch className={styles.loadingIcon} />
    <UnstyledButton className={styles.clearButton ?? ""}>
      <XCircle weight="fill" className={styles.clearIcon} />
    </UnstyledButton>
  </SearchField>
);

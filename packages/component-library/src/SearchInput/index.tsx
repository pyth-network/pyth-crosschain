"use client";

import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { CSSProperties, ComponentProps } from "react";

import styles from "./index.module.scss";
import { Button } from "../unstyled/Button/index.jsx";
import { SearchField } from "../unstyled/SearchField/index.jsx";
import { Input } from "../unstyled/TextField/index.jsx";

export const SIZES = ["xs", "sm", "md", "lg"] as const;

type Props = ComponentProps<typeof SearchField> & {
  label?: string | undefined;
  size?: (typeof SIZES)[number] | undefined;
  width?: number | undefined;
  isPending?: boolean | undefined;
  placeholder?: string;
};

export const SearchInput = ({
  label,
  size = "md",
  width,
  className,
  isPending,
  placeholder = "Search",
  ...props
}: Props) => (
  <SearchField
    aria-label={label ?? "Search"}
    className={clsx(styles.searchInput, className)}
    data-size={size}
    data-static-width={width === undefined ? undefined : ""}
    {...(width && { style: { "--width": width } as CSSProperties })}
    {...(isPending && { "data-pending": "" })}
    {...props}
  >
    <Input className={styles.input ?? ""} placeholder={placeholder} />
    <MagnifyingGlass className={styles.searchIcon} />
    <CircleNotch className={styles.loadingIcon} />
    <Button className={styles.clearButton ?? ""}>
      <XCircle weight="fill" className={styles.clearIcon} />
    </Button>
  </SearchField>
);

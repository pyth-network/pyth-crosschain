"use client";

import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import type { ComponentProps, ReactNode } from "react";

import { Button } from "../Button";
import styles from "./index.module.scss";


type OwnProps = {
  largeScreenText?: ReactNode | undefined;
  smallScreenText?: ReactNode | undefined;
};

type Props =  Pick<
  ComponentProps<typeof Button>,
  'beforeIcon' | 'size' | 'onClick'
> &
  OwnProps;
  
export const SearchButton = ({
  beforeIcon,
  largeScreenText,
  smallScreenText,
  ...props
}: Props) => {
  return (
    <div className={styles.searchButton}>
    <Button
      className={styles.largeScreenSearchButton ?? ""}
      variant="outline"
      beforeIcon={beforeIcon ?? <MagnifyingGlass />}
      size="sm"
      rounded
      
      {...props}
    >
      {largeScreenText}
    </Button>
    <Button
      className={styles.smallScreenSearchButton ?? ""}
      hideText
      variant="ghost"
      beforeIcon={beforeIcon ?? <MagnifyingGlass />}
      size="sm"
      rounded
      {...props}
    >
      {smallScreenText}
    </Button>
  </div>
  );
};

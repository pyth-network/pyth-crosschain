import type { ComponentProps, ReactNode } from "react";

export type StatCardVariant = "primary" | "secondary";

type SingleStatProps = {
  header: ReactNode;
  stat: ReactNode;
  miniStat?: ReactNode;
  corner?: ReactNode;
  small?: boolean;
};

type DualStatProps = {
  header1: ReactNode;
  header2: ReactNode;
  stat1: ReactNode;
  stat2: ReactNode;
  miniStat1?: ReactNode;
  miniStat2?: ReactNode;
};

export type StatCardProps = ComponentProps<"div"> & {
  variant?: StatCardVariant;
} & (SingleStatProps | DualStatProps);

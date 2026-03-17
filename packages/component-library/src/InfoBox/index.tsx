"use client";

import {
  Confetti,
  DotOutline,
  HardDrives,
  Info,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

export const VARIANTS = [
  "neutral",
  "info",
  "warning",
  "error",
  "data",
  "success",
] as const;

const DEFAULTS: Default = {
  data: {
    header: "Data",
    icon: <HardDrives />,
  },
  error: {
    header: "Error",
    icon: <XCircle />,
  },
  info: {
    header: "Info",
    icon: <Info />,
  },
  neutral: {
    header: "-",
    icon: <DotOutline />,
  },
  success: {
    header: "Success",
    icon: <Confetti />,
  },
  warning: {
    header: "Warning",
    icon: <WarningCircle />,
  },
};

type Default = Record<
  (typeof VARIANTS)[number],
  {
    header: string;
    icon: ReactNode;
  }
>;

type Props = ComponentProps<"div"> & {
  icon?: ReactNode;
  header?: ReactNode;
  variant?: (typeof VARIANTS)[number] | undefined;
};

export const InfoBox = ({
  icon,
  header,
  children,
  className,
  variant = "info",
  ...props
}: Props) => (
  <div
    className={clsx(className, styles.infoBox)}
    data-variant={variant}
    {...props}
  >
    <div className={styles.icon}>{icon ?? DEFAULTS[variant].icon}</div>
    <div className={styles.body}>
      <h3 className={styles.header}>{header ?? DEFAULTS[variant].header}</h3>
      <div className={styles.contents}>{children}</div>
    </div>
  </div>
);

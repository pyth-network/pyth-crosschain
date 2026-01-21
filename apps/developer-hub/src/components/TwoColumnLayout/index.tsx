import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./index.module.scss";

type TwoColumnLayoutProps = {
  children: ReactNode;
  className?: string;
};

type LeftColumnProps = {
  children: ReactNode;
  className?: string;
};

type RightColumnProps = {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
};

export function TwoColumnLayout({ children, className }: TwoColumnLayoutProps) {
  return <div className={clsx(styles.container, className)}>{children}</div>;
}

export function LeftColumn({ children, className }: LeftColumnProps) {
  return <div className={clsx(styles.leftColumn, className)}>{children}</div>;
}

export function RightColumn({
  children,
  className,
  sticky = true,
}: RightColumnProps) {
  return (
    <div
      className={clsx(styles.rightColumn, sticky && styles.sticky, className)}
    >
      {children}
    </div>
  );
}

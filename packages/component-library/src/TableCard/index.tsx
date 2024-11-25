import type { ComponentType, ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";
import { Card } from "../Card/index.js";
import { Table } from "../Table/index.js";

type Props<T extends string> = ComponentProps<typeof Table<T>> & {
  icon?: ComponentType<{ className?: string | undefined }> | undefined;
  title?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  toolbar?: ReactNode | ReactNode[] | undefined;
};

export const TableCard = <T extends string>({
  icon: Icon,
  title,
  footer,
  toolbar,
  ...props
}: Props<T>) => (
  <Card className={styles.tableCard}>
    <div className={styles.header}>
      <h2 className={styles.title}>
        {Icon && <Icon className={styles.icon} />}
        {title ?? props.label}
      </h2>
      {toolbar}
    </div>
    <Table {...props} />
    {footer && <div className={styles.footer}>{footer}</div>}
  </Card>
);

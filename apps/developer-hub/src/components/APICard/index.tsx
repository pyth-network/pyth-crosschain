import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./index.module.scss";

type APICardProps = {
  href: string;
  title: string;
  method: string;
  description?: string;
};

type APICardsProps = {
  children: ReactNode;
};

export function APICards({ children }: APICardsProps) {
  return <div className={styles.grid}>{children}</div>;
}

export function APICard({ href, title, method, description }: APICardProps) {
  const methodLower = method.toLowerCase();

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.title}>
        <span className={styles.name}>{title}</span>
        <span
          className={clsx(
            styles.badge,
            methodLower === "get" && styles.get,
            methodLower === "post" && styles.post,
            methodLower === "put" && styles.put,
            methodLower === "patch" && styles.patch,
            methodLower === "delete" && styles.delete,
          )}
        >
          {method}
        </span>
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </Link>
  );
}

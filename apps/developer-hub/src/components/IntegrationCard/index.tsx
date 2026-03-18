import { clsx } from "clsx";
import Link from "next/link";

import styles from "./index.module.scss";

type IntegrationCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorScheme?: "blue" | "green" | "purple" | "yellow";
  external?: boolean;
  showArrow?: boolean;
};

export function IntegrationCard({
  href,
  icon,
  title,
  description,
  colorScheme = "blue",
  external,
  showArrow,
}: IntegrationCardProps) {
  const shouldShowArrow = showArrow ?? !external;
  const commonProps = {
    "aria-label": title,
    className: clsx(styles.card, "group"),
    href,
  };

  const content = (
    <>
      <div className={styles.header}>
        <div className={clsx(styles.iconContainer, styles[colorScheme])}>
          <div className={clsx(styles.icon, styles[colorScheme])}>{icon}</div>
        </div>
        <h3 className={clsx(styles.title, styles[colorScheme])}>{title}</h3>
        {shouldShowArrow && (
          <span aria-hidden="true" className={styles.arrow}>
            →
          </span>
        )}
      </div>
      <p className={styles.description}>{description}</p>
    </>
  );

  return (
    <Link
      {...commonProps}
      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
    >
      {content}
    </Link>
  );
}

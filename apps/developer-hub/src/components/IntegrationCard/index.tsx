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
    href,
    className: clsx(styles.card, "group"),
    "aria-label": title,
  };

  const content = (
    <>
      <div className={styles.header}>
        <div className={clsx(styles.iconContainer, styles[colorScheme])}>
          <div className={clsx(styles.icon, styles[colorScheme])}>{icon}</div>
        </div>
        <h3 className={clsx(styles.title, styles[colorScheme])}>{title}</h3>
        {shouldShowArrow && (
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        )}
      </div>
      <p className={styles.description}>{description}</p>
    </>
  );

  return external ? (
    <a {...commonProps} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link {...commonProps}>{content}</Link>
  );
}

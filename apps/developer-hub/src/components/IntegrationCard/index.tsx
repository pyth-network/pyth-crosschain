import { clsx } from "clsx";
import Link from "next/link";

import styles from "./index.module.scss";

type Feature = {
  icon: React.ReactNode;
  text: string;
};

type IntegrationCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorScheme?: "blue" | "green" | "purple" | "yellow";
  external?: boolean;
  showArrow?: boolean;
  features?: Feature[];
};

export function IntegrationCard({
  href,
  icon,
  title,
  description,
  colorScheme = "blue",
  external,
  showArrow = true,
  features,
}: IntegrationCardProps) {
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
        {showArrow && (
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        )}
      </div>
      <p className={styles.description}>{description}</p>
      {features && features.length > 0 && (
        <div className="space-y-3 mt-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">
                {feature.icon}
              </div>
              <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      )}
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

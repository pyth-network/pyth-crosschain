import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./section-card.module.scss";

export const SectionCard = ({
  title,
  description,
  urlLabel,
  url,
  image,
  target,
}: {
  title: string;
  description: string;
  urlLabel?: string;
  url?: string;
  image?: ReactNode;
  target?: string;
}) => (
  <div className={styles.sectionCard}>
    <div className={styles.sectionCardHeader}>
      <h3 className={styles.sectionCardTitle}>{title}</h3>
      {image}
    </div>
    <p className={styles.sectionCardDescription}>{description}</p>
    {url && urlLabel && (
      <Link
        href={url}
        className={styles.sectionCardUrl}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
      >
        {urlLabel}
      </Link>
    )}
  </div>
);

export const SectionCards = ({ children }: { children: ReactNode }) => (
  <div className={styles.sectionCards}>{children}</div>
);

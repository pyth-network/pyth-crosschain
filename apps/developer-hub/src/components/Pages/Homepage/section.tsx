import type { ReactNode } from "react";

import styles from "./section.module.scss";

export const Section = ({
  title,
  subtitle,
  image,
  isHighlight,
  children,
}: {
  title: string;
  subtitle: string;
  image?: ReactNode;
  isHighlight?: boolean;
  children: React.ReactNode;
}) => (
  <section className={styles.section} data-highlight={isHighlight}>
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionHeaderTitle}>{title}</h2>
          <p className={styles.sectionHeaderSubtitle}>{subtitle}</p>
        </div>
        {image}
      </div>
      {children}
    </div>
  </section>
);

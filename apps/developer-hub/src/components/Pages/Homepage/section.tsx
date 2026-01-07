import type { ReactNode } from "react";

import styles from "./section.module.scss";
import { SectionTitle } from "../../Shared/section-title";

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
  <section data-highlight={isHighlight} className={styles.section}>
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <SectionTitle title={title} subtitle={subtitle} />
        {image}
      </div>
      {children}
    </div>
  </section>
);

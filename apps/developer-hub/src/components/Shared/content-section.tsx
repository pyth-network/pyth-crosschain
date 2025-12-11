import styles from "./content-section.module.scss";

import { SectionTitle } from "./section-title";

export const Section = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <SectionTitle
          title="Products"
          subtitle="Connect to the global market data and randomness layer."
        />
        {children}
      </div>
    </section>
  );
};

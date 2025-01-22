import styles from "./index.module.scss";

export const Stats = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={styles.statWrapper}>
      <div className={styles.statsContainer}>{children}</div>
    </div>
  );
};

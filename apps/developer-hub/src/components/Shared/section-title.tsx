import styles from "./section-title.module.scss";

export const SectionTitle = ({ title, subtitle, children }: {
    title: string;
    subtitle: string;
    children?: React.ReactNode;
}) => {
    return (
        <div className={styles.sectionTitle}>
            <div>
                <p className={styles.title}>{title}</p>
                <p className={styles.subtitle}>{subtitle}</p>
            </div>
            {children && <div className={styles.slot}>{children}</div>}
        </div>
    );
}
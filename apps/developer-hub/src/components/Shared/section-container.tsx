
import styles from './section-container.module.scss';

export const SectionContainer = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={styles.container}>
            {children}
        </div>
    )
}
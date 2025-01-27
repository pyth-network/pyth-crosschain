import type { ReactNode } from "react";

import styles from "./page-layout.module.scss";

export const PageLayout = ({ children, title, actions }: { children: ReactNode; title: ReactNode, actions?: ReactNode }) => {
    return (
        <div className={styles.pageLayout}>
            <div className={styles.pageTitleContainer}>
                <h1 className={styles.pageTitle}>{title}</h1>
                {actions && <div className={styles.actions}>{actions}</div>}
            </div>
            {children}
        </div>
    )
}
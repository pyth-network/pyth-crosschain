import type { ReactNode } from "react"

import styles from "./page-title.module.scss"

export const PageTitle = ({ children }: { children: ReactNode }) => {
    return (
        <h1 className={styles.pageTitle}>{children}</h1>
    )
}
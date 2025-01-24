import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

type CardTitleProps = {
    children: ReactNode;
    icon?: ReactNode | undefined;
    badge?: ReactNode;
} & ComponentProps<"div">;

export const CardTitle = ({ children, icon, badge, ...props }: CardTitleProps) => {
    return (
        <div className={clsx(styles.cardTitle, props.className)} {...props}>
            {icon && <div className={styles.icon}>{icon}</div>}
            <h2 className={styles.title}>{children}</h2>
            {badge}
        </div>
    )
}
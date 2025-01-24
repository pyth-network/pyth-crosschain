import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

type StructuredListProps = {
    items: StructureListItemProps[];
} & ComponentProps<"div">;

type StructureListItemProps = {
    label: React.ReactNode;
    value: React.ReactNode;
} & ComponentProps<"div">;


export const StructuredList = ({
    items,
    ...props
}: StructuredListProps) => {
    return (
        items.length > 0 && (
            <div className={clsx(styles.structuredList, props.className)} {...props}>
                {items.map((item, index) => (
                    <StructuredListItem key={index} {...item} />
                ))}
            </div>
        )
    );
};


export const StructuredListItem = ({
    label,
    value,
    ...props
}: StructureListItemProps) => {
    return (
        <div className={clsx(styles.structuredListItem, props.className)} {...props}>
            <div className={styles.structuredListItemLabel}>{label}</div>
            <div className={styles.structuredListItemValue}>{value}</div>
        </div>
    );
}
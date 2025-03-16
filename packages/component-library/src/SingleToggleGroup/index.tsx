"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { useId, useMemo } from "react";
import type { Key } from "react-aria-components";
import { ToggleButtonGroup, ToggleButton } from "react-aria-components";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";

type OwnProps = {
  selectedKey?: Key | undefined;
  onSelectionChange?: (newValue: Key) => void;
  items: ComponentProps<typeof ToggleButton>[];
};
type Props = Omit<
  ComponentProps<typeof ToggleButtonGroup>,
  keyof OwnProps | "selectionMode" | "selectedKeys"
> &
  OwnProps;

export const SingleToggleGroup = ({
  selectedKey,
  onSelectionChange,
  className,
  items,
  ...props
}: Props) => {
  const id = useId();

  const handleSelectionChange = useMemo(
    () =>
      onSelectionChange
        ? (set: Set<Key>) => {
            const { value } = set.values().next();
            if (value !== undefined) {
              onSelectionChange(value);
            }
          }
        : undefined,
    [onSelectionChange],
  );

  return (
    <ToggleButtonGroup
      className={clsx(styles.singleToggleGroup, className)}
      selectionMode="single"
      {...(handleSelectionChange && {
        onSelectionChange: handleSelectionChange,
      })}
      {...(selectedKey !== undefined && { selectedKeys: [selectedKey] })}
      {...props}
    >
      {items.map(({ className: tabClassName, children, ...toggleButton }) => (
        <ToggleButton
          key={toggleButton.id}
          className={clsx(
            styles.toggleButton,
            buttonStyles.button,
            tabClassName,
          )}
          data-size="sm"
          data-variant="ghost"
          {...toggleButton}
        >
          {(args) => (
            <>
              {args.isSelected && (
                <motion.span
                  layoutId={`${id}-bubble`}
                  className={styles.bubble}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                  style={{ originY: "top" }}
                />
              )}
              <span className={buttonStyles.text}>
                {typeof children === "function" ? children(args) : children}
              </span>
            </>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

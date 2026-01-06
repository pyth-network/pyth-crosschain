"use client";

import clsx from "clsx";

import type { PriceFeedProperty } from "../types";
import { PROPERTY_OPTIONS } from "../types";
import styles from "./index.module.scss";

type PropertiesSelectorProps = {
  selectedProperties: PriceFeedProperty[];
  onSelectionChange: (properties: PriceFeedProperty[]) => void;
  className?: string;
};

export function PropertiesSelector({
  selectedProperties,
  onSelectionChange,
  className,
}: PropertiesSelectorProps) {
  const handleToggle = (property: PriceFeedProperty) => {
    if (selectedProperties.includes(property)) {
      // Don't allow deselecting if it's the only one selected
      if (selectedProperties.length > 1) {
        onSelectionChange(selectedProperties.filter((prop) => prop !== property));
      }
    } else {
      onSelectionChange([...selectedProperties, property]);
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.label}>Properties</span>
        <span className={styles.count}>{selectedProperties.length} selected</span>
      </div>

      <div className={styles.options} role="group" aria-label="Property selection">
        {PROPERTY_OPTIONS.map((option) => {
          const isSelected = selectedProperties.includes(option.id);
          return (
            <label key={option.id} className={styles.option}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  handleToggle(option.id);
                }}
                className={styles.checkbox}
                aria-label={option.label}
              />
              <span className={styles.optionContent}>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDescription}>{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}


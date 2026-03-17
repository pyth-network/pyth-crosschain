"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import clsx from "clsx";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { PriceFeedProperty } from "../types";
import { PROPERTY_OPTIONS } from "../types";
import styles from "./index.module.scss";

type PropertiesSelectorProps = {
  className?: string;
};

export function PropertiesSelector({ className }: PropertiesSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const selectedProperties = config.properties;

  const handleToggle = (property: PriceFeedProperty) => {
    if (selectedProperties.includes(property)) {
      // Don't allow deselecting if it's the only one selected
      if (selectedProperties.length > 1) {
        updateConfig({
          properties: selectedProperties.filter((prop) => prop !== property),
        });
      }
    } else {
      updateConfig({ properties: [...selectedProperties, property] });
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.label}>Properties</span>
        <span className={styles.count}>
          {selectedProperties.length} selected
        </span>
      </div>

      <div
        aria-label="Property selection"
        className={styles.chipGrid}
        role="group"
      >
        {PROPERTY_OPTIONS.map((option) => {
          const isSelected = selectedProperties.includes(option.id);
          return (
            <button
              aria-pressed={isSelected}
              className={clsx(styles.chip, {
                [styles.selected ?? ""]: isSelected,
              })}
              key={option.id}
              onClick={() => {
                handleToggle(option.id);
              }}
              title={option.description}
              type="button"
            >
              {isSelected && (
                <Check className={styles.checkIcon} weight="bold" />
              )}
              <span className={styles.chipLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

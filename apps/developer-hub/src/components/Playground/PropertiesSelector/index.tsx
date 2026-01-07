"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import clsx from "clsx";

import styles from "./index.module.scss";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { PriceFeedProperty } from "../types";
import { PROPERTY_OPTIONS } from "../types";

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
        className={styles.chipGrid}
        role="group"
        aria-label="Property selection"
      >
        {PROPERTY_OPTIONS.map((option) => {
          const isSelected = selectedProperties.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={clsx(styles.chip, {
                [styles.selected ?? ""]: isSelected,
              })}
              onClick={() => {
                handleToggle(option.id);
              }}
              aria-pressed={isSelected}
              title={option.description}
            >
              {isSelected && (
                <Check weight="bold" className={styles.checkIcon} />
              )}
              <span className={styles.chipLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

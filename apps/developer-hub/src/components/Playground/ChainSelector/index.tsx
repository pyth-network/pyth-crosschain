"use client";

import clsx from "clsx";

import type { ChainFormat } from "../types";
import { CHAIN_OPTIONS } from "../types";
import styles from "./index.module.scss";

type ChainSelectorProps = {
  selectedChains: ChainFormat[];
  onSelectionChange: (chains: ChainFormat[]) => void;
  className?: string;
};

export function ChainSelector({
  selectedChains,
  onSelectionChange,
  className,
}: ChainSelectorProps) {
  const handleToggle = (chain: ChainFormat) => {
    if (selectedChains.includes(chain)) {
      // Don't allow deselecting if it's the only one selected
      if (selectedChains.length > 1) {
        onSelectionChange(selectedChains.filter((selectedChain) => selectedChain !== chain));
      }
    } else {
      onSelectionChange([...selectedChains, chain]);
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.label}>Target Chains</span>
        <span className={styles.count}>{selectedChains.length} selected</span>
      </div>

      <div className={styles.options} role="group" aria-label="Target chain selection">
        {CHAIN_OPTIONS.map((option) => {
          const isSelected = selectedChains.includes(option.id);
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


"use client";

import clsx from "clsx";

import styles from "./index.module.scss";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { ChainFormat } from "../types";
import { CHAIN_OPTIONS } from "../types";

type ChainSelectorProps = {
  className?: string;
};

export function ChainSelector({ className }: ChainSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const selectedChains = config.formats;

  const handleToggle = (chain: ChainFormat) => {
    if (selectedChains.includes(chain)) {
      // Don't allow deselecting if it's the only one selected
      if (selectedChains.length > 1) {
        updateConfig({
          formats: selectedChains.filter(
            (selectedChain) => selectedChain !== chain
          ),
        });
      }
    } else {
      updateConfig({ formats: [...selectedChains, chain] });
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.label}>Target Chains</span>
        <span className={styles.count}>{selectedChains.length} selected</span>
      </div>

      <div
        className={styles.options}
        role="group"
        aria-label="Target chain selection"
      >
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
                <span className={styles.optionDescription}>
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

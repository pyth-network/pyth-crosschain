"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
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
            (selectedChain) => selectedChain !== chain,
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
        className={styles.chipGrid}
        role="group"
        aria-label="Target chain selection"
      >
        {CHAIN_OPTIONS.map((option) => {
          const isSelected = selectedChains.includes(option.id);
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

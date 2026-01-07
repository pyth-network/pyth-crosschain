"use client";

import { Select } from "@pythnetwork/component-library/Select";
import clsx from "clsx";

import styles from "./index.module.scss";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { Channel } from "../types";
import { CHANNEL_OPTIONS } from "../types";

type ChannelSelectorProps = {
  className?: string;
};

const selectOptions = CHANNEL_OPTIONS.map((option) => ({
  id: option.id,
  label: option.label,
  description: option.description,
}));

const isValidChannel = (key: string | number): key is Channel => {
  return CHANNEL_OPTIONS.some((option) => option.id === key);
};

export function ChannelSelector({ className }: ChannelSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();

  const handleSelectionChange = (key: string | number) => {
    if (isValidChannel(key)) {
      updateConfig({ channel: key });
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <Select
        label="Channel"
        options={selectOptions}
        selectedKey={config.channel}
        onSelectionChange={handleSelectionChange}
        show={(option) => (
          <span className={styles.optionDisplay}>{option.label}</span>
        )}
        variant="outline"
        size="sm"
      />
    </div>
  );
}

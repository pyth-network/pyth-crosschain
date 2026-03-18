"use client";

import { Select } from "@pythnetwork/component-library/Select";
import clsx from "clsx";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { Channel } from "../types";
import { CHANNEL_OPTIONS } from "../types";
import styles from "./index.module.scss";

type ChannelSelectorProps = {
  className?: string;
};

const selectOptions = CHANNEL_OPTIONS.map((option) => ({
  description: option.description,
  id: option.id,
  label: option.label,
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
        onSelectionChange={handleSelectionChange}
        options={selectOptions}
        selectedKey={config.channel}
        show={(option) => (
          <span className={styles.optionDisplay}>{option.label}</span>
        )}
        size="sm"
        variant="outline"
      />
    </div>
  );
}

"use client";

import { Select } from "@pythnetwork/component-library/Select";
import clsx from "clsx";

import type { Channel } from "../types";
import { CHANNEL_OPTIONS } from "../types";
import styles from "./index.module.scss";

type ChannelSelectorProps = {
  selectedChannel: Channel;
  onSelectionChange: (channel: Channel) => void;
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

export function ChannelSelector({
  selectedChannel,
  onSelectionChange,
  className,
}: ChannelSelectorProps) {
  const handleSelectionChange = (key: string | number) => {
    if (isValidChannel(key)) {
      onSelectionChange(key);
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <Select
        label="Update Channel"
        options={selectOptions}
        selectedKey={selectedChannel}
        onSelectionChange={handleSelectionChange}
        show={(option) => (
          <span className={styles.optionDisplay}>{option.label}</span>
        )}
        variant="outline"
        size="sm"
      />
      <span className={styles.description}>
        {CHANNEL_OPTIONS.find((opt) => opt.id === selectedChannel)?.description}
      </span>
    </div>
  );
}


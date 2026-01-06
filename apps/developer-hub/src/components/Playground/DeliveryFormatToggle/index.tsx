"use client";

import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import clsx from "clsx";

import type { DeliveryFormat } from "../types";
import styles from "./index.module.scss";

type DeliveryFormatToggleProps = {
  selectedFormat: DeliveryFormat;
  onSelectionChange: (format: DeliveryFormat) => void;
  className?: string;
};

const formatOptions = [
  { id: "json", children: "JSON" },
  { id: "binary", children: "Binary" },
];

export function DeliveryFormatToggle({
  selectedFormat,
  onSelectionChange,
  className,
}: DeliveryFormatToggleProps) {
  const handleChange = (key: string | number) => {
    onSelectionChange(key as DeliveryFormat);
  };

  return (
    <div className={clsx(styles.container, className)}>
      <span className={styles.label}>Delivery Format</span>
      <SingleToggleGroup
        items={formatOptions}
        selectedKey={selectedFormat}
        onSelectionChange={handleChange}
        className={styles.toggleGroup ?? ""}
      />
      <span className={styles.description}>
        {selectedFormat === "json"
          ? "Human-readable JSON response"
          : "Compact binary format for performance"}
      </span>
    </div>
  );
}


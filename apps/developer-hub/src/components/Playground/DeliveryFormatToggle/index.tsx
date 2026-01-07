"use client";

import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import clsx from "clsx";

import styles from "./index.module.scss";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { DeliveryFormat } from "../types";

type DeliveryFormatToggleProps = {
  className?: string;
};

const formatOptions = [
  { id: "json", children: "JSON" },
  { id: "binary", children: "Binary" },
];

export function DeliveryFormatToggle({ className }: DeliveryFormatToggleProps) {
  const { config, updateConfig } = usePlaygroundContext();

  const handleChange = (key: string | number) => {
    updateConfig({ deliveryFormat: key as DeliveryFormat });
  };

  return (
    <div className={clsx(styles.container, className)}>
      <span className={styles.label}>Delivery Format</span>
      <SingleToggleGroup
        items={formatOptions}
        selectedKey={config.deliveryFormat}
        onSelectionChange={handleChange}
        className={styles.toggleGroup ?? ""}
      />
      <span className={styles.description}>
        {config.deliveryFormat === "json"
          ? "Human-readable JSON response"
          : "Compact binary format for performance"}
      </span>
    </div>
  );
}

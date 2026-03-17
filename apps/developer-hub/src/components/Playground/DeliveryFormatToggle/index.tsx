"use client";

import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import clsx from "clsx";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { DeliveryFormat } from "../types";
import styles from "./index.module.scss";

type DeliveryFormatToggleProps = {
  className?: string;
};

const formatOptions = [
  { children: "JSON", id: "json" },
  { children: "Binary", id: "binary" },
];

export function DeliveryFormatToggle({ className }: DeliveryFormatToggleProps) {
  const { config, updateConfig } = usePlaygroundContext();

  const handleChange = (key: string | number) => {
    updateConfig({ deliveryFormat: key as DeliveryFormat });
  };

  return (
    <div className={clsx(styles.container, className)}>
      <span className={styles.label}>Format</span>
      <SingleToggleGroup
        className={styles.toggleGroup ?? ""}
        items={formatOptions}
        onSelectionChange={handleChange}
        selectedKey={config.deliveryFormat}
      />
    </div>
  );
}

"use client";

import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { Button } from "@pythnetwork/component-library/Button";
import { useState } from "react";

import styles from "./index.module.scss";
import { AccessTokenInput } from "../../Playground/AccessTokenInput";
import { ChainSelector } from "../../Playground/ChainSelector";
import { ChannelSelector } from "../../Playground/ChannelSelector";
import { CodePreview } from "../../Playground/CodePreview";
import { DeliveryFormatToggle } from "../../Playground/DeliveryFormatToggle";
import { PriceFeedSelector } from "../../Playground/PriceFeedSelector";
import { PropertiesSelector } from "../../Playground/PropertiesSelector";
import type { PlaygroundConfig } from "../../Playground/types";
import { DEFAULT_CONFIG } from "../../Playground/types";

// Placeholder for run code functionality - will be implemented in Phase 5
function handleRunCode() {
  // TODO: Implement SSE connection to execute code
}

export function PlaygroundPage() {
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_CONFIG);

  // Update handlers for each config property
  const handleAccessTokenChange = (accessToken: string) => {
    setConfig((prev) => ({ ...prev, accessToken }));
  };

  const handlePriceFeedIdsChange = (priceFeedIds: number[]) => {
    setConfig((prev) => ({ ...prev, priceFeedIds }));
  };

  const handlePropertiesChange = (properties: PlaygroundConfig["properties"]) => {
    setConfig((prev) => ({ ...prev, properties }));
  };

  const handleFormatsChange = (formats: PlaygroundConfig["formats"]) => {
    setConfig((prev) => ({ ...prev, formats }));
  };

  const handleChannelChange = (channel: PlaygroundConfig["channel"]) => {
    setConfig((prev) => ({ ...prev, channel }));
  };

  const handleDeliveryFormatChange = (deliveryFormat: PlaygroundConfig["deliveryFormat"]) => {
    setConfig((prev) => ({ ...prev, deliveryFormat }));
  };

  return (
    <div className={styles.playground}>
      <section className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Pyth Pro Playground</h1>
          <p className={styles.subtitle}>
            Configure subscription parameters, generate code, and test real-time
            price streams.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.contentInner}>
          <div className={styles.mainGrid}>
            {/* Left Panel - Configuration */}
            <div className={styles.configPanel}>
              <div className={styles.configSection}>
                <AccessTokenInput
                  accessToken={config.accessToken}
                  onAccessTokenChange={handleAccessTokenChange}
                />
              </div>

              <div className={styles.configSection}>
                <h3 className={styles.sectionTitle}>Price Feeds</h3>
                <PriceFeedSelector
                  selectedIds={config.priceFeedIds}
                  onSelectionChange={handlePriceFeedIdsChange}
                />
              </div>

              <div className={styles.configSection}>
                <h3 className={styles.sectionTitle}>Properties</h3>
                <PropertiesSelector
                  selectedProperties={config.properties}
                  onSelectionChange={handlePropertiesChange}
                />
              </div>

              <div className={styles.configSection}>
                <h3 className={styles.sectionTitle}>Signature Format</h3>
                <ChainSelector
                  selectedChains={config.formats}
                  onSelectionChange={handleFormatsChange}
                />
              </div>

              <div className={styles.configRow}>
                <div className={styles.configSection}>
                  <ChannelSelector
                    selectedChannel={config.channel}
                    onSelectionChange={handleChannelChange}
                  />
                </div>

                <div className={styles.configSection}>
                  <DeliveryFormatToggle
                    selectedFormat={config.deliveryFormat}
                    onSelectionChange={handleDeliveryFormatChange}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel - Code Preview */}
            <div className={styles.codePanel}>
              <CodePreview config={config} />

              <div className={styles.runSection}>
                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleRunCode}
                  className={styles.runButton ?? ""}
                >
                  <Play weight="fill" />
                  Run Code
                </Button>
                <p className={styles.runHint}>
                  Execute the generated code to see live price updates
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { Button } from "@pythnetwork/component-library/Button";

import styles from "./index.module.scss";
import { AccessTokenInput } from "../../Playground/AccessTokenInput";
import { ChainSelector } from "../../Playground/ChainSelector";
import { ChannelSelector } from "../../Playground/ChannelSelector";
import { CodePreview } from "../../Playground/CodePreview";
import { DeliveryFormatToggle } from "../../Playground/DeliveryFormatToggle";
import { PlaygroundProvider } from "../../Playground/PlaygroundContext";
import { PriceFeedSelector } from "../../Playground/PriceFeedSelector";
import { PropertiesSelector } from "../../Playground/PropertiesSelector";

// Placeholder for run code functionality - will be implemented in Phase 5
function handleRunCode() {
  // TODO: Implement SSE connection to execute code
}

export function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <div className={styles.playground}>
        <section className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Pyth Pro Playground</h1>
            <p className={styles.subtitle}>
              Configure subscription parameters, generate code, and test
              real-time price streams.
            </p>
          </div>
        </section>

        <section className={styles.content}>
          <div className={styles.contentInner}>
            <div className={styles.mainGrid}>
              {/* Left Panel - Configuration */}
              <div className={styles.configPanel}>
                <AccessTokenInput />
                <PriceFeedSelector />
                <PropertiesSelector />
                <ChainSelector />

                <div className={styles.configRow}>
                  <ChannelSelector />
                  <DeliveryFormatToggle />
                </div>
              </div>

              {/* Right Panel - Code Preview */}
              <div className={styles.codePanel}>
                <CodePreview />

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
    </PlaygroundProvider>
  );
}

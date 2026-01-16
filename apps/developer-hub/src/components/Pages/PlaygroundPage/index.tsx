"use client";

import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop";
import { Button } from "@pythnetwork/component-library/Button";
import { Callout } from "fumadocs-ui/components/callout";
import { useCallback, useMemo, useRef } from "react";

import styles from "./index.module.scss";
import { AccessTokenInput } from "../../Playground/AccessTokenInput";
import { ChainSelector } from "../../Playground/ChainSelector";
import { ChannelSelector } from "../../Playground/ChannelSelector";
import { CodePreview } from "../../Playground/CodePreview";
import { DeliveryFormatToggle } from "../../Playground/DeliveryFormatToggle";
import type { OutputPanelHandle } from "../../Playground/OutputPanel";
import { OutputPanel } from "../../Playground/OutputPanel";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "../../Playground/PlaygroundContext";
import { PriceFeedSelector } from "../../Playground/PriceFeedSelector";
import { PropertiesSelector } from "../../Playground/PropertiesSelector";
import type { StreamCallbacks } from "../../Playground/hooks/use-stream-execution";
import { useStreamExecution } from "../../Playground/hooks/use-stream-execution";

function PlaygroundContent() {
  const { config } = usePlaygroundContext();
  const outputPanelRef = useRef<OutputPanelHandle>(null);

  // Define callbacks that imperatively control the OutputPanel
  const handleFirstMessage = useCallback(() => {
    // Instant scroll to bottom when first message arrives
    outputPanelRef.current?.scrollToBottom("auto");
  }, []);

  const handleMessage = useCallback(() => {
    // Smooth scroll if auto-scroll is enabled
    if (outputPanelRef.current?.isAutoScrollEnabled()) {
      outputPanelRef.current.scrollToBottom("smooth");
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    // Reset auto-scroll when a new stream starts
    if (newStatus === "connecting") {
      outputPanelRef.current?.resetAutoScroll();
    }
  }, []);

  const streamCallbacks = useMemo<StreamCallbacks>(
    () => ({
      onFirstMessage: handleFirstMessage,
      onMessage: handleMessage,
      onStatusChange: handleStatusChange,
    }),
    [handleFirstMessage, handleMessage, handleStatusChange],
  );

  const { status, messages, error, startStream, stopStream, clearMessages } =
    useStreamExecution(streamCallbacks);

  const isStreaming = status === "connecting" || status === "connected";

  const handleRunClick = () => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream(config);
    }
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
          <Callout type="warning" className={styles.disclaimer}>
            This playground is for internal preview only and may contain bugs.
          </Callout>
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

            {/* Right Panel - Code Preview and Output */}
            <div className={styles.codePanel}>
              <CodePreview />

              <div className={styles.runSection}>
                <Button
                  variant={isStreaming ? "danger" : "primary"}
                  size="sm"
                  beforeIcon={
                    isStreaming ? (
                      <Stop weight="fill" />
                    ) : (
                      <Play weight="fill" />
                    )
                  }
                  onPress={handleRunClick}
                  className={styles.runButton ?? ""}
                  isDisabled={status === "connecting"}
                >
                  {isStreaming ? "Stop" : "Run"}
                </Button>
                <span className={styles.runHint}>
                  {isStreaming
                    ? "Streaming live price updates..."
                    : "Execute code to test live price updates"}
                </span>
              </div>

              <OutputPanel
                ref={outputPanelRef}
                status={status}
                messages={messages}
                error={error}
                onClear={clearMessages}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <PlaygroundContent />
    </PlaygroundProvider>
  );
}

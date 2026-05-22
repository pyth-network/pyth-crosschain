"use client";

import type { OnMount } from "@monaco-editor/react";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop";
import { Button } from "@pythnetwork/component-library/Button";
import { useCopy } from "@pythnetwork/component-library/useCopy";
import { clsx } from "clsx";
import dynamic from "next/dynamic";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStreamExecution } from "../Playground/hooks/use-stream-execution";
import type { PlaygroundConfig } from "../Playground/types";
import type { LandingFeed } from "./feeds";
import { LANDING_FEEDS } from "./feeds";
import styles from "./index.module.scss";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Loading editor…</div>,
});

type MonacoEditorInstance = Parameters<OnMount>[0];

const DEFAULT_FEED: LandingFeed = LANDING_FEEDS[0]!;

const buildWscatCommand = (feed: LandingFeed): string => {
  const subscribe = JSON.stringify({
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds: [feed.lazerId],
    properties: ["price"],
    formats: ["solana"],
    channel: "fixed_rate@200ms",
    parsed: true,
  });
  return [
    "$ wscat -c wss://pyth-lazer.dourolabs.app/v1/stream \\",
    '    -H "Authorization: Bearer $PYTH_PRO_KEY"',
    "",
    `> ${subscribe}`,
  ].join("\n");
};

const buildConfig = (feed: LandingFeed): PlaygroundConfig => ({
  accessToken: "",
  priceFeedIds: [feed.lazerId],
  properties: ["price"],
  formats: ["solana"],
  channel: "fixed_rate@200ms",
  deliveryFormat: "json",
  jsonBinaryEncoding: "hex",
  parsed: true,
});

type StreamPayload = {
  type?: string;
  error?: string;
  parsed?: {
    priceFeeds?: { priceFeedId?: number; price?: string | number }[];
  };
};

const formatStreamLine = (
  event: string,
  data: unknown,
  feed: LandingFeed,
): string | undefined => {
  if (event === "connected") return "# Connected";
  if (event === "subscribed") return `# Subscribed to ${feed.symbol}`;
  if (event === "close") return "# Closed";
  if (event === "error") {
    const errData = data as { error?: string; message?: string } | undefined;
    return `! ${errData?.error ?? errData?.message ?? "stream error"}`;
  }
  if (event === "message") {
    const payload = data as StreamPayload | undefined;
    if (payload?.type === "subscriptionError") {
      return `! ${payload.error ?? "subscription error"}`;
    }
    const rawPrice = payload?.parsed?.priceFeeds?.[0]?.price;
    if (rawPrice === undefined || rawPrice === null) return undefined;
    const usd = Number(rawPrice) * 10 ** feed.exponent;
    if (!Number.isFinite(usd)) return undefined;
    const formatted = usd.toLocaleString("en-US", {
      minimumFractionDigits: feed.displayPrecision,
      maximumFractionDigits: feed.displayPrecision,
    });
    return `< ${formatted}`;
  }
  return undefined;
};

export const MinimalPlayground = () => {
  const [selectedFeed, setSelectedFeed] = useState<LandingFeed>(DEFAULT_FEED);
  const { status, messages, startStream, stopStream } = useStreamExecution();
  const editorRef = useRef<MonacoEditorInstance | undefined>(undefined);

  const command = useMemo(
    () => buildWscatCommand(selectedFeed),
    [selectedFeed],
  );
  const { isCopied, copy } = useCopy(command);

  const isStreaming = status === "connecting" || status === "connected";

  const handleSelect = useCallback(
    (feed: LandingFeed) => {
      stopStream();
      setSelectedFeed(feed);
    },
    [stopStream],
  );

  const handleRun = useCallback(() => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream(buildConfig(selectedFeed));
    }
  }, [isStreaming, selectedFeed, startStream, stopStream]);

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (isStreaming) {
        stopStream();
        return;
      }
      const lazerId = Number(event.currentTarget.dataset.lazerId);
      const feed = LANDING_FEEDS.find((f) => f.lazerId === lazerId);
      if (feed) {
        setSelectedFeed(feed);
        startStream(buildConfig(feed));
      }
    },
    [isStreaming, startStream, stopStream],
  );

  const formattedLines = useMemo(
    () =>
      messages
        .map((m) => ({
          id: m.id,
          line: formatStreamLine(m.event, m.data, selectedFeed),
        }))
        .filter((item): item is { id: string; line: string } =>
          item.line !== undefined,
        ),
    [messages, selectedFeed],
  );

  const hasOutput = formattedLines.length > 0;
  const showIdleHint = !isStreaming && !hasOutput;

  const editorValue = useMemo(() => {
    let text = command;
    if (hasOutput) {
      text += "\n\n" + formattedLines.map((f) => f.line).join("\n");
    }
    if (showIdleHint) {
      text += "\n\n# Press Run or Enter to stream live updates";
    }
    return text;
  }, [command, hasOutput, formattedLines, showIdleHint]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && hasOutput) {
      const model = editor.getModel();
      if (model) {
        editor.revealLine(model.getLineCount());
      }
    }
  }, [formattedLines.length, hasOutput]);

  const handleEditorMount = useCallback<OnMount>((editor) => {
    editorRef.current = editor;
  }, []);

  const statusLabel = (() => {
    if (status === "connecting") return "Connecting…";
    if (status === "connected") return "● Live";
    if (status === "error") return "Error";
    if (status === "closed" && hasOutput) return "Closed";
    return "wscat";
  })();

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.title}>Try the price feed</p>
        </header>

        <div className={styles.layout}>
          <ul
            className={styles.feedList}
            role="listbox"
            aria-label="Select a price feed"
          >
            {LANDING_FEEDS.map((feed) => {
              const isActive = feed.lazerId === selectedFeed.lazerId;
              return (
                <li key={feed.lazerId} className={styles.feedItem}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-lazer-id={feed.lazerId}
                    className={clsx(
                      styles.feedRow,
                      isActive && styles.feedRowActive,
                    )}
                    onClick={() => {
                      handleSelect(feed);
                    }}
                    onKeyDown={handleRowKeyDown}
                  >
                    {feed.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.terminal}>
            <div className={styles.terminalHeader}>
              <span
                className={clsx(
                  styles.terminalLabel,
                  status === "connected" && styles.terminalLabelLive,
                )}
              >
                {statusLabel}
              </span>
              <div className={styles.terminalActions}>
                <Button
                  size="xs"
                  variant="ghost"
                  beforeIcon={<Copy weight="bold" />}
                  hideText
                  onPress={copy}
                  aria-label={isCopied ? "Copied!" : "Copy command"}
                >
                  {isCopied ? "Copied!" : "Copy"}
                </Button>
                <Button
                  size="xs"
                  variant={isStreaming ? "danger" : "solid"}
                  beforeIcon={
                    isStreaming ? (
                      <Stop weight="fill" />
                    ) : (
                      <Play weight="fill" />
                    )
                  }
                  onPress={handleRun}
                  isDisabled={status === "connecting"}
                >
                  {isStreaming ? "Stop" : "Run"}
                </Button>
              </div>
            </div>
            <div className={styles.editorContainer}>
              <MonacoEditor
                height="100%"
                language="shell"
                value={editorValue}
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: "off",
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 16,
                  lineNumbersMinChars: 0,
                  renderLineHighlight: "none",
                  wordWrap: "on",
                  automaticLayout: true,
                  contextmenu: false,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.ctaRow}>
          <Button
            href="/price-feeds/pro/price-feed-ids"
            variant="outline"
            size="md"
          >
            Browse all feeds
          </Button>
          <Button href="/playground" variant="primary" size="md">
            Open full playground
          </Button>
        </div>
      </div>
    </section>
  );
};

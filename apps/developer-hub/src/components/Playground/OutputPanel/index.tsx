"use client";

import { ArrowLineDown } from "@phosphor-icons/react/dist/ssr/ArrowLineDown";
import { Pause } from "@phosphor-icons/react/dist/ssr/Pause";
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import styles from "./index.module.scss";
import type {
  StreamMessage,
  StreamStatus,
} from "../hooks/use-stream-execution";

type OutputPanelProps = {
  status: StreamStatus;
  messages: StreamMessage[];
  error: { message: string } | undefined;
  onClear: () => void;
  className?: string | undefined;
};

const STATUS_LABELS: Record<StreamStatus, string> = {
  idle: "Ready",
  connecting: "Connecting...",
  connected: "Connected",
  error: "Error",
  closed: "Closed",
};

const STATUS_COLORS: Record<StreamStatus, string> = {
  idle: styles.statusIdle ?? "",
  connecting: styles.statusConnecting ?? "",
  connected: styles.statusConnected ?? "",
  error: styles.statusError ?? "",
  closed: styles.statusClosed ?? "",
};

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return timestamp;
  }
}

function formatEventData(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  try {
    return JSON.stringify(data, undefined, 2);
  } catch {
    return String(data);
  }
}

export function OutputPanel({
  status,
  messages,
  error,
  onClear,
  className,
}: OutputPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // Track previous message count to detect empty-to-content transition
  const prevMessageCountRef = useRef(0);

  // Reset auto-scroll state when a new stream starts
  useEffect(() => {
    if (status === "connecting") {
      setAutoScroll(true);
      prevMessageCountRef.current = 0;
    }
  }, [status]);

  // Force scroll to bottom when messages transition from empty to having content
  useEffect(() => {
    const wasEmpty = prevMessageCountRef.current === 0;
    const hasContent = messages.length > 0;

    if (wasEmpty && hasContent && messagesEndRef.current) {
      // Force immediate scroll to bottom when first message arrives
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        }
      });
    }

    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive (only if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && messagesEndRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      });
    }
  }, [messages, autoScroll]);

  const handleToggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  return (
    <div className={clsx(styles.container, className)}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.statusSection}>
          <span className={clsx(styles.statusDot, STATUS_COLORS[status])} />
          <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
          {messages.length > 0 && (
            <span className={styles.messageCount}>
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            onPress={handleToggleAutoScroll}
            beforeIcon={
              autoScroll ? (
                <Pause weight="bold" />
              ) : (
                <ArrowLineDown weight="bold" />
              )
            }
            hideText
            aria-label={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
          >
            {autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={onClear}
            isDisabled={messages.length === 0}
            beforeIcon={<Trash weight="bold" />}
            hideText
            aria-label="Clear messages"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠</span>
          <span className={styles.errorMessage}>{error.message}</span>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No messages yet.</p>
            <p className={styles.emptyHint}>
              Click &quot;Run&quot; to start streaming price updates.
            </p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(styles.message, {
                  [styles.messageError ?? ""]: message.event === "error",
                  [styles.messageSystem ?? ""]:
                    message.event === "connected" ||
                    message.event === "subscribed" ||
                    message.event === "close",
                })}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.messageTime}>
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <span
                    className={clsx(styles.messageEvent, {
                      [styles.eventError ?? ""]: message.event === "error",
                      [styles.eventSystem ?? ""]:
                        message.event === "connected" ||
                        message.event === "subscribed" ||
                        message.event === "close",
                      [styles.eventMessage ?? ""]: message.event === "message",
                    })}
                  >
                    {message.event}
                  </span>
                </div>
                <pre className={styles.messageData}>
                  {formatEventData(message.data)}
                </pre>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

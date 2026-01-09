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
  // Track if user explicitly toggled auto-scroll via button
  const userToggledRef = useRef(false);
  // Track if we're doing a programmatic scroll
  const isProgrammaticScrollRef = useRef(false);

  // Auto-scroll to bottom when new messages arrive (only if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      // Reset the flag after the scroll animation completes
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 100);
    }
  }, [messages, autoScroll]);

  // Detect manual scrolling and disable auto-scroll if user scrolls up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Ignore programmatic scrolls
      if (isProgrammaticScrollRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold

      // If user scrolls away from bottom, disable auto-scroll
      if (!isAtBottom && autoScroll) {
        userToggledRef.current = false; // Reset user toggle since this is a scroll action
        setAutoScroll(false);
      }
      // If user scrolls back to bottom, re-enable auto-scroll (only if not explicitly toggled off)
      else if (isAtBottom && !autoScroll && !userToggledRef.current) {
        setAutoScroll(true);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [autoScroll]);

  const handleToggleAutoScroll = () => {
    userToggledRef.current = true;
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

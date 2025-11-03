"use client";

import { Copy, Check, Eye, OpenAiLogo } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import type { ComponentType } from "react";
import { useState } from "react";

import styles from "./index.module.scss";
import { ClaudeIcon } from "../../lib/icons";

type PageActionOption = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  url?: string;
  type: "copy" | "markdown" | "llm";
  ariaLabel?: string;
};

type PageAction = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  ariaLabel?: string;
};

type PageActionsProps = {
  content: string;
  title: string;
  url: string;
};

const getPageActionOptions = (): PageActionOption[] => [
  {
    id: "copy-page",
    label: "Copy Page",
    icon: Copy,
    type: "copy",
    ariaLabel: "Copy page content",
  },
  {
    id: "view-markdown",
    label: "View Markdown",
    icon: Eye,
    type: "markdown",
    ariaLabel: "View page as Markdown",
  },
  {
    id: "ask-chatgpt",
    label: "Ask in ChatGPT",
    icon: OpenAiLogo,
    url: "https://chat.openai.com",
    type: "llm",
    ariaLabel: "Ask in ChatGPT",
  },
  {
    id: "ask-claude",
    label: "Ask in Claude",
    icon: ClaudeIcon,
    url: "https://claude.ai",
    type: "llm",
    ariaLabel: "Ask in Claude",
  },
];

export function PageActions({ content, title, url }: PageActionsProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const logger = useLogger();
  const pageActionOptions = getPageActionOptions();

  async function handleCopy(key: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 1200);
    } catch (error) {
      logger.error(error);
    }
  }

  function handleViewMarkdown() {
    const blob = new Blob([content], { type: "text/plain" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    // Clean up the URL after a delay to ensure it opens
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  }

  function handleShare(option: PageActionOption) {
    if (option.type === "llm" && option.url) {
      const prompt = `Please read and analyze this documentation page:

        Title: ${title}
        URL: ${url}

        Content:
        ${content}

        Please provide a summary and answer any questions I might have about this content.`;

      const encodedInstruction = encodeURIComponent(prompt);
      const shareUrl =
        option.label === "Ask in Claude"
          ? `https://claude.ai/new?q=${encodedInstruction}`
          : `${option.url}?q=${encodedInstruction}`;

      window.open(shareUrl, "_blank");
    }
  }

  const actions: PageAction[] = pageActionOptions.map((option) => {
    let onClick: () => void;

    if (option.type === "copy") {
      onClick = () => {
        handleCopy(option.id).catch(() => {
          /* no-op */
        });
      };
    } else if (option.type === "markdown") {
      onClick = handleViewMarkdown;
    } else {
      onClick = () => {
        handleShare(option);
      };
    }

    return {
      id: option.id,
      label: option.label,
      icon: option.icon,
      onClick,
      ariaLabel: option.ariaLabel ?? option.label,
    };
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isLast = index === actions.length - 1;

          const pageOption = pageActionOptions.find(
            (opt) => opt.id === action.id,
          );
          const isCopyAction = pageOption?.type === "copy";
          const showCheckIcon = isCopyAction && copiedStates[action.id];

          return (
            <div key={action.id} className={styles.buttonWrapper}>
              <Button
                onPress={action.onClick}
                size="sm"
                variant="ghost"
                className={styles.button ?? ""}
                aria-label={action.ariaLabel ?? action.label}
                beforeIcon={
                  showCheckIcon ? (
                    <Check className={styles.icon ?? ""} />
                  ) : (
                    <Icon className={styles.icon ?? ""} />
                  )
                }
              >
                {action.label}
              </Button>
              {!isLast && (
                <div className={styles.verticalDivider} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.horizontalDivider} aria-hidden="true" />
    </div>
  );
}

"use client";

import { Copy, Check, Eye, OpenAiLogo } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { useCopy } from "@pythnetwork/component-library/useCopy";
import type { ReactNode } from "react";

import styles from "./index.module.scss";
import { ClaudeIcon } from "../../lib/icons";

type PageActionOption = {
  id: string;
  label: string;
  icon: ReactNode;
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
    icon: <Copy />,
  },
  {
    id: "view-markdown",
    label: "View Markdown",
    icon: <Eye />,
  },
  {
    id: "ask-chatgpt",
    label: "Ask in ChatGPT",
    icon: <OpenAiLogo />,
  },
  {
    id: "ask-claude",
    label: "Ask in Claude",
    icon: <ClaudeIcon />,
  },
];

export function PageActions({ content, title, url }: PageActionsProps) {
  const { isCopied, copy } = useCopy(content);
  const pageActionOptions = getPageActionOptions();

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
    const prompt = `Please read and analyze this documentation page:

        Title: ${title}
        URL: ${url}

        Content:
        ${content}

        Please provide a summary and answer any questions I might have about this content.`;

    const encodedInstruction = encodeURIComponent(prompt);

    if (option.id === "ask-claude") {
      const shareUrl = `https://claude.ai/new?q=${encodedInstruction}`;
      window.open(shareUrl, "_blank");
    } else if (option.id === "ask-chatgpt") {
      const shareUrl = `https://chat.openai.com?q=${encodedInstruction}`;
      window.open(shareUrl, "_blank");
    }
  }

  function handleActionClick(option: PageActionOption) {
    switch (option.id) {
      case "copy-page": {
        copy();
        break;
      }
      case "view-markdown": {
        handleViewMarkdown();
        break;
      }
      case "ask-chatgpt":
      case "ask-claude": {
        handleShare(option);
        break;
      }
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {pageActionOptions.map((option, index) => {
          const isLast = index === pageActionOptions.length - 1;
          const isCopyAction = option.id === "copy-page";
          const showCheckIcon = isCopyAction && isCopied;

          return (
            <div key={option.id} className={styles.buttonWrapper}>
              <Button
                onPress={() => {
                  handleActionClick(option);
                }}
                size="sm"
                variant="ghost"
                className={styles.button ?? ""}
                aria-label={option.ariaLabel ?? option.label}
                beforeIcon={
                  showCheckIcon ? (
                    <Check className={styles.icon ?? ""} />
                  ) : (
                    option.icon
                  )
                }
              >
                {option.label}
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

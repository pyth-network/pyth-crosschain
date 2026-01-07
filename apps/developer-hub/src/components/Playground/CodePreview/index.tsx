"use client";

import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import styles from "./index.module.scss";
import {
  generateCode,
  getFileExtension,
  getMonacoLanguage,
} from "../CodeGenerators";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { CodeLanguage } from "../types";
import { CODE_LANGUAGE_OPTIONS } from "../types";

// Dynamically import Monaco to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Loading editor...</div>,
});

type CodePreviewProps = {
  className?: string;
};

export function CodePreview({ className }: CodePreviewProps) {
  const { config } = usePlaygroundContext();
  const [activeLanguage, setActiveLanguage] =
    useState<CodeLanguage>("typescript");
  const [copied, setCopied] = useState(false);

  // Generate code for the active language
  const code = useMemo(() => {
    return generateCode(activeLanguage, config);
  }, [activeLanguage, config]);

  // Get Monaco language ID
  const monacoLanguage = useMemo(() => {
    return getMonacoLanguage(activeLanguage);
  }, [activeLanguage]);

  // Copy code to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [code]);

  // Download code as file
  const handleDownload = useCallback(() => {
    const extension = getFileExtension(activeLanguage);
    const filename = `pyth-lazer-example.${extension}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [code, activeLanguage]);

  return (
    <div className={clsx(styles.container, className)}>
      {/* Header with tabs and actions */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          {CODE_LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={clsx(styles.tab, {
                [styles.active ?? ""]: activeLanguage === option.id,
              })}
              onClick={() => {
                setActiveLanguage(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            beforeIcon={<Copy weight="bold" />}
            hideText
            onPress={() => {
              void handleCopy();
            }}
            className={styles.actionButton ?? ""}
            aria-label={copied ? "Copied!" : "Copy"}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            beforeIcon={<DownloadSimple weight="bold" />}
            hideText
            onPress={handleDownload}
            className={styles.actionButton ?? ""}
            aria-label="Download"
          >
            Download
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className={styles.editorWrapper}>
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "on",
            renderLineHighlight: "none",
            folding: true,
            wordWrap: "on",
            automaticLayout: true,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            padding: {
              top: 16,
              bottom: 16,
            },
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Button } from "@pythnetwork/component-library/Button";
import { useCopy } from "@pythnetwork/component-library/useCopy";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import {
  generateCode,
  getFileExtension,
  getMonacoLanguage,
} from "../CodeGenerators";
import { usePlaygroundContext } from "../PlaygroundContext";
import type { CodeLanguage } from "../types";
import { CODE_LANGUAGE_OPTIONS } from "../types";
import styles from "./index.module.scss";

// Dynamically import Monaco to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => <div className={styles.editorLoading}>Loading editor...</div>,
  ssr: false,
});

type CodePreviewProps = {
  className?: string;
};

export function CodePreview({ className }: CodePreviewProps) {
  const { config } = usePlaygroundContext();
  const [activeLanguage, setActiveLanguage] =
    useState<CodeLanguage>("typescript");

  // Generate code for the active language
  const code = useMemo(() => {
    return generateCode(activeLanguage, config);
  }, [activeLanguage, config]);

  // Get Monaco language ID
  const monacoLanguage = useMemo(() => {
    return getMonacoLanguage(activeLanguage);
  }, [activeLanguage]);

  // Use component library's copy hook
  const { isCopied, copy } = useCopy(code);

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
              className={clsx(styles.tab, {
                [styles.active ?? ""]: activeLanguage === option.id,
              })}
              key={option.id}
              onClick={() => {
                setActiveLanguage(option.id);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            aria-label={isCopied ? "Copied!" : "Copy"}
            beforeIcon={
              isCopied ? (
                <Check className={styles.checkIcon ?? ""} weight="bold" />
              ) : (
                <Copy weight="bold" />
              )
            }
            className={styles.actionButton ?? ""}
            hideText
            onPress={copy}
            size="sm"
            variant="ghost"
          >
            {isCopied ? "Copied!" : "Copy"}
          </Button>
          <Button
            aria-label="Download"
            beforeIcon={<DownloadSimple weight="bold" />}
            className={styles.actionButton ?? ""}
            hideText
            onPress={handleDownload}
            size="sm"
            variant="ghost"
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
          options={{
            automaticLayout: true,
            folding: true,
            fontSize: 13,
            lineNumbers: "on",
            minimap: { enabled: false },
            padding: {
              bottom: 16,
              top: 16,
            },
            readOnly: true,
            renderLineHighlight: "none",
            scrollBeyondLastLine: false,
            scrollbar: {
              horizontal: "auto",
              horizontalScrollbarSize: 8,
              vertical: "auto",
              verticalScrollbarSize: 8,
            },
            wordWrap: "on",
          }}
          theme="vs-dark"
          value={code}
        />
      </div>
    </div>
  );
}

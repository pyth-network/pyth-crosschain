"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { Button } from "@pythnetwork/component-library/Button";
import { useCopy } from "@pythnetwork/component-library/useCopy";
import clsx from "clsx";
import dynamic from "next/dynamic";

import styles from "./index.module.scss";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Loading editor...</div>,
});

type StaticCodePreviewProps = {
  code: string;
  language?: string;
  className?: string;
  height?: string;
};

export function StaticCodePreview({
  code,
  language = "json",
  className,
  height = "500px",
}: StaticCodePreviewProps) {
  const { isCopied, copy } = useCopy(code);

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.languageLabel}>{language.toUpperCase()}</span>
        <Button
          variant="ghost"
          size="sm"
          beforeIcon={
            isCopied ? (
              <Check weight="bold" className={styles.checkIcon} />
            ) : (
              <Copy weight="bold" />
            )
          }
          hideText
          onPress={copy}
          {...(styles.actionButton && { className: styles.actionButton })}
          aria-label={isCopied ? "Copied!" : "Copy"}
        >
          {isCopied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className={styles.editorWrapper} style={{ height }}>
        <Editor
          height="100%"
          language={language}
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

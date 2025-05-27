"use client";

import { CheckSquare, Copy } from "@phosphor-icons/react";
import { Link } from "@pythnetwork/component-library/unstyled/Link";
import { useRef, useState } from "react";
import { useClipboard, useKeyboard, usePress } from "react-aria";

import TruncateToMiddle from "../TruncateToMiddle";
import styles from "./index.module.scss";

const CopyAddress = ({ address, url }: { address: string; url?: string }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const timeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const showCopied = () => {
    setCopied(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setCopied(false);
      timeout.current = undefined;
    }, 2000);
  };

  const { clipboardProps } = useClipboard({
    getItems() {
      showCopied();
      return [
        {
          "text/plain": address,
        },
      ];
    },
  });

  const { pressProps } = usePress({
    onPress: () => {
      void writeClipboardText(address);
    },
  });

  const { keyboardProps } = useKeyboard({
    onKeyUp: (e) => {
      if (e.key === "Enter") {
        void writeClipboardText(address);
      }
    },
  });

  async function writeClipboardText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showCopied();
    } catch {
      // Silent fail - clipboard operations may not be supported in all environments
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void writeClipboardText(address);
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        void writeClipboardText(address);
      }}
      {...clipboardProps}
      {...pressProps}
      {...keyboardProps}
      className={styles.copyAddress}
      role="button"
      aria-label="Copy address to clipboard"
    >
      {url ? (
        <Link href={url}>
          <TruncateToMiddle text={address} />
        </Link>
      ) : (
        <TruncateToMiddle text={address} />
      )}
      <div className={styles.icon}>
        {copied ? (
          <CheckSquare size={24} className={styles.copied} />
        ) : (
          <Copy size={24} />
        )}
      </div>
    </div>
  );
};

export default CopyAddress;

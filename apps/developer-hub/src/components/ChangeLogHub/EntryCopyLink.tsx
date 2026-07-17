"use client";

import clsx from "clsx";
import { useState } from "react";

import styles from "./index.module.scss";

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.copyLinkIcon}
    fill="none"
    height="13"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="13"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.copyLinkIcon}
    fill="none"
    height="13"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="13"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Copies a clean deep link (origin + /changelog + #slug, no query params) for
// a single entry. Sibling of ChangeLog/CopyLinkButton, which anchors days in
// the market-data stream.
export const EntryCopyLink = ({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    // navigator.clipboard is undefined outside secure contexts; reading
    // .writeText off it would throw synchronously, before the .catch below.
    if (!window.navigator.clipboard) {
      return;
    }
    window.navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch(() => {
        // Clipboard can reject (insecure context / denied permission); ignore.
      });
  };

  return (
    <button
      aria-label={`Copy link to “${title}”`}
      className={clsx(styles.copyLink, copied && styles.copyLinkActive)}
      onClick={copy}
      type="button"
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied && <span className={styles.copyLinkText}>Copied</span>}
    </button>
  );
};

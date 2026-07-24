"use client";

import { useCopy } from "@pythnetwork/component-library/useCopy";
import clsx from "clsx";

import { CHANGELOG_PATH, SITE } from "../../lib/changelog";
import styles from "./index.module.scss";

const ChainIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.chain}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// The entry date doubles as its permalink: clicking copies a canonical
// docs.pyth.network deep link and anchors the URL to the entry. The
// relative-time line flips to a "Link copied" confirmation while active.
export const EntryCopyLink = ({
  slug,
  date,
  relative,
}: {
  slug: string;
  date: string;
  relative: string;
}) => {
  const { copy, isCopied } = useCopy(`${SITE}${CHANGELOG_PATH}#${slug}`, 1500);

  return (
    <>
      <button
        aria-label={`Copy link to this update (${date})`}
        className={clsx(styles.datelink, isCopied && styles.datelinkCopied)}
        onClick={() => {
          globalThis.history.replaceState(null, "", `#${slug}`);
          // navigator.clipboard is undefined outside secure contexts; useCopy
          // would throw synchronously rather than reject, so guard here.
          if (globalThis.navigator.clipboard) {
            copy();
          }
        }}
        type="button"
      >
        <span className={styles.dt}>{date}</span>
        <ChainIcon />
      </button>
      <div className={clsx(styles.rock, isCopied && styles.rockCopied)}>
        {isCopied ? "Link copied" : relative}
      </div>
      {/* The visible confirmation above is a plain div; mirror it into a live
          region so screen readers announce the copy. */}
      <span className={styles.srStatus} role="status">
        {isCopied ? "Link copied" : ""}
      </span>
    </>
  );
};

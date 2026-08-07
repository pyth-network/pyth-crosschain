"use client";

import { Link as LinkIcon } from "@phosphor-icons/react/dist/ssr";
import { useCopy } from "@pythnetwork/component-library/useCopy";
import clsx from "clsx";

import { CHANGELOG_PATH, SITE } from "../../lib/changelog";
import styles from "./index.module.scss";

// The entry date doubles as its permalink: clicking copies a canonical
// docs.pyth.network deep link and anchors the URL to the entry. The adjacent
// relative-time label flips to a "Link copied" confirmation while active.
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
        <time className={styles.dt}>{date}</time>
        <LinkIcon aria-hidden className={styles.chain} />
      </button>
      <span aria-hidden className={styles.sep}>
        ·
      </span>
      <span className={clsx(styles.relTime, isCopied && styles.relCopied)}>
        {isCopied ? "Link copied" : relative}
      </span>
      {/* The visible confirmation is a plain span; mirror it into a live region
          so screen readers announce the copy. */}
      <span className={styles.srStatus} role="status">
        {isCopied ? "Link copied" : ""}
      </span>
    </>
  );
};
